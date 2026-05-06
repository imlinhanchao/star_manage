import axios from 'axios'

let BASE_URL = 'https://api.github.com'

export function setApiBaseUrl(url) {
  BASE_URL = url ? url.replace(/\/$/, '') : 'https://api.github.com'
}

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

/**
 * Fetches all starred repositories across all pages.
 * Returns an array of repo objects shaped like { ...repo, starred_at }.
 */
export async function getAllStarredRepos(token, { sort = 'created', direction = 'desc' } = {}) {
  const client = createClient(token)
  let page = 1
  let allRepos = []

  while (true) {
    const res = await client.get('/user/starred', {
      params: { page, per_page: 100, sort, direction },
      headers: { Accept: 'application/vnd.github.star+json' },
    })
    const repos = res.data.map(item =>
      item.repo ? { ...item.repo, starred_at: item.starred_at } : item,
    )
    allRepos = allRepos.concat(repos)
    const linkHeader = res.headers['link'] || ''
    if (!linkHeader.includes('rel="next"')) break
    page++
  }

  return allRepos
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
    `${BASE_URL}/graphql`,
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
 * Fetches repositories from a specific GitHub Star List using cursor-based pagination.
 * Returns { repos, totalCount, hasNextPage, endCursor }
 * Each repo item is shaped as { repo, starred_at: null } to match the REST starred API.
 */
export async function getListItems(token, listId, { first = 30, after = null } = {}) {
  const query = `
    query GetListItems($listId: ID!, $first: Int!, $after: String) {
      node(id: $listId) {
        ... on UserList {
          items(first: $first, after: $after) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              ... on Repository {
                databaseId
                id
                name
                nameWithOwner
                description
                url
                isPrivate
                isFork
                isArchived
                stargazerCount
                forkCount
                updatedAt
                primaryLanguage {
                  name
                }
                repositoryTopics(first: 10) {
                  nodes {
                    topic {
                      name
                    }
                  }
                }
                owner {
                  login
                  avatarUrl
                  url
                }
              }
            }
          }
        }
      }
    }
  `
  const data = await graphql(token, query, { listId, first, after })
  if (!data.node) throw new Error('List not found')
  const items = data.node.items
  const repos = (items.nodes || []).map(node => ({
    repo: {
      id: node.databaseId,
      node_id: node.id,
      name: node.name,
      full_name: node.nameWithOwner,
      description: node.description,
      html_url: node.url,
      private: node.isPrivate,
      fork: node.isFork,
      archived: node.isArchived,
      stargazers_count: node.stargazerCount,
      forks_count: node.forkCount,
      updated_at: node.updatedAt,
      language: node.primaryLanguage?.name ?? null,
      topics: (node.repositoryTopics?.nodes || []).map(n => n.topic.name),
      owner: {
        login: node.owner.login,
        avatar_url: node.owner.avatarUrl,
        html_url: node.owner.url,
      },
    },
    starred_at: null,
  }))
  return {
    repos,
    totalCount: items.totalCount,
    hasNextPage: items.pageInfo.hasNextPage,
    endCursor: items.pageInfo.endCursor,
  }
}

/**
 * Fetches all repositories from a specific GitHub Star List across all pages.
 * Returns an array shaped like [{ repo, starred_at: null }].
 */
export async function getAllListItems(token, listId) {
  let allItems = []
  let after = null

  while (true) {
    const { repos, hasNextPage, endCursor } = await getListItems(token, listId, { first: 100, after })
    allItems = allItems.concat(repos)
    if (!hasNextPage) break
    after = endCursor
  }

  return allItems
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
