import axios from 'axios'

const BASE_URL = 'https://api.github.com'

function createClient(token) {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
}

export async function validateToken(token) {
  const client = createClient(token)
  const res = await client.get('/user')
  return res.data
}

export async function getStarredRepos(token, { page = 1, perPage = 30, sort = 'created', direction = 'desc' } = {}) {
  const client = createClient(token)
  const res = await client.get('/user/starred', {
    params: { page, per_page: perPage, sort, direction },
    headers: {
      Accept: 'application/vnd.github.star+json',
    },
  })
  const linkHeader = res.headers['link'] || ''
  const totalCount = parseTotalFromLink(linkHeader, page, perPage, res.data.length)
  // With star+json, each item has { starred_at, repo }
  // Without it, items are plain repos
  const repos = res.data.map(item =>
    item.repo ? { ...item.repo, starred_at: item.starred_at } : item,
  )
  return { repos, totalCount, linkHeader }
}

export async function unstarRepo(token, owner, repo) {
  const client = createClient(token)
  await client.delete(`/user/starred/${owner}/${repo}`)
}

export async function starRepo(token, owner, repo) {
  const client = createClient(token)
  await client.put(`/user/starred/${owner}/${repo}`, null, {
    headers: { 'Content-Length': 0 },
  })
}

function parseTotalFromLink(linkHeader, currentPage, perPage, currentCount) {
  if (!linkHeader) {
    return currentPage * perPage - perPage + currentCount
  }
  const lastMatch = linkHeader.match(/page=(\d+)[^>]*>;\s*rel="last"/)
  if (lastMatch) {
    return parseInt(lastMatch[1], 10) * perPage
  }
  const nextMatch = linkHeader.match(/page=(\d+)[^>]*>;\s*rel="next"/)
  if (!nextMatch) {
    return currentPage * perPage - perPage + currentCount
  }
  return null
}

// ── GitHub Star Lists (GraphQL) ─────────────────────────────────────────────

async function graphql(token, query, variables = {}) {
  const res = await axios.post(
    'https://api.github.com/graphql',
    { query, variables },
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (res.data.errors) {
    throw new Error(res.data.errors.map(e => e.message).join('; '))
  }
  return res.data.data
}

/**
 * Returns the viewer's GitHub Star Lists, each with their contained repo node IDs.
 * Shape: [{ id, name, slug, isPrivate, repoNodeIds: Set<string> }]
 */
export async function getUserLists(token) {
  const query = `
    query {
      viewer {
        lists(first: 100) {
          nodes {
            id
            name
            slug
            isPrivate
            items(first: 100) {
              nodes {
                ... on Repository {
                  id
                }
              }
            }
          }
        }
      }
    }
  `
  const data = await graphql(token, query)
  return (data.viewer.lists.nodes || []).map(list => ({
    id: list.id,
    name: list.name,
    slug: list.slug,
    isPrivate: list.isPrivate,
    repoNodeIds: new Set((list.items.nodes || []).map(n => n.id).filter(Boolean)),
  }))
}

/** Creates a new GitHub Star List, returns { id, name }. */
export async function createUserList(token, name, { description = '', isPrivate = false } = {}) {
  const mutation = `
    mutation CreateList($name: String!, $description: String, $isPrivate: Boolean) {
      createUserList(input: { name: $name, description: $description, isPrivate: $isPrivate }) {
        list {
          id
          name
          slug
          isPrivate
        }
      }
    }
  `
  const data = await graphql(token, mutation, { name, description, isPrivate })
  const list = data.createUserList.list
  return { ...list, repoNodeIds: new Set() }
}

/** Deletes a GitHub Star List by its GraphQL node ID. */
export async function deleteUserList(token, listId) {
  const mutation = `
    mutation DeleteList($listId: ID!) {
      deleteUserList(input: { listId: $listId }) {
        clientMutationId
      }
    }
  `
  await graphql(token, mutation, { listId })
}

/**
 * Sets which lists a repository belongs to (replaces all memberships atomically).
 * @param {string} token
 * @param {string} repoNodeId  – GraphQL node_id of the repository
 * @param {string[]} listIds   – GraphQL node IDs of all lists the repo should be in
 * Returns updated [{ id, name, repoNodeIds }] lists.
 */
export async function updateUserListsForItem(token, repoNodeId, listIds) {
  const mutation = `
    mutation UpdateListsForItem($itemId: ID!, $listIds: [ID!]!) {
      updateUserListsForItem(input: { itemId: $itemId, listIds: $listIds }) {
        lists {
          id
          name
          slug
          isPrivate
          items(first: 100) {
            nodes {
              ... on Repository {
                id
              }
            }
          }
        }
      }
    }
  `
  const data = await graphql(token, mutation, { itemId: repoNodeId, listIds })
  return (data.updateUserListsForItem.lists || []).map(list => ({
    id: list.id,
    name: list.name,
    slug: list.slug,
    isPrivate: list.isPrivate,
    repoNodeIds: new Set((list.items.nodes || []).map(n => n.id).filter(Boolean)),
  }))
}
