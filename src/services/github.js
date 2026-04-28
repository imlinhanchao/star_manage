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

export function getLists() {
  try {
    return JSON.parse(localStorage.getItem('star_lists') || '[]')
  } catch {
    return []
  }
}

export function saveLists(lists) {
  localStorage.setItem('star_lists', JSON.stringify(lists))
}

export function addRepoToList(listName, repo) {
  const lists = getLists()
  const list = lists.find(l => l.name === listName)
  if (list) {
    if (!list.repos.find(r => r.id === repo.id)) {
      list.repos.push({ id: repo.id, full_name: repo.full_name })
    }
  } else {
    lists.push({ name: listName, repos: [{ id: repo.id, full_name: repo.full_name }] })
  }
  saveLists(lists)
  return lists
}

export function removeRepoFromList(listName, repoId) {
  const lists = getLists()
  const list = lists.find(l => l.name === listName)
  if (list) {
    list.repos = list.repos.filter(r => r.id !== repoId)
  }
  saveLists(lists)
  return lists
}

export function getRepoLists(repoId) {
  const lists = getLists()
  return lists.filter(l => l.repos.some(r => r.id === repoId)).map(l => l.name)
}

export function createList(name) {
  const lists = getLists()
  if (!lists.find(l => l.name === name)) {
    lists.push({ name, repos: [] })
    saveLists(lists)
  }
  return lists
}

export function deleteList(name) {
  const lists = getLists().filter(l => l.name !== name)
  saveLists(lists)
  return lists
}
