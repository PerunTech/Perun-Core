import axios from 'axios'
import { mergeGroups, toGroup, toPerson } from './people'

const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
const ws = (path) => `${window.server}/WsAdminConsole/${path}`
const re = (path) => `${window.server}/ReactElements/${path}`

// The services answer most failures with 200 and a body of type ERROR.
const checked = (res) => {
  if (String(res?.data?.type).toUpperCase() === 'ERROR') throw res
  return res
}

const postJson = (url, data) => axios.post(url, encodeURIComponent(JSON.stringify(data)), FORM)

// searchUsers leaves out the password hashes that getTableData sends.
export const listPeople = (sid) => postJson(ws(`searchUsers/${sid}`), { USER_NAME: '' })
  .then(res => (Array.isArray(res.data) ? res.data.map(toPerson) : []))

export const getAccess = (sid, userId) =>
  axios.get(ws(`get-permission-matrix-by-user/sid/${sid}/user_object_id/${userId}`)).then(checked).then(res => res.data)

export const getGroups = (sid, userId) => axios.get(ws(`getLinkedGroups/${sid}/${userId}`)).then(checked)
  .then(res => (Array.isArray(res.data) ? mergeGroups(res.data.map(toGroup)) : []))

export const getAllGroups = (sid) => axios.get(ws(`getAllGroups/${sid}`)).then(checked)
  .then(res => (Array.isArray(res.data?.data) ? res.data.data : []))

// Read once per session: the ACL catalog, each group's ACLs and members. A group's ACLs are dropped when edited here.
const cache = { sid: undefined, entries: new Map() }

const cached = (sid, name, load) => {
  if (cache.sid !== sid) {
    cache.sid = sid
    cache.entries = new Map()
  }
  if (!cache.entries.has(name)) {
    const pending = load()
    cache.entries.set(name, pending)
    pending.catch(() => cache.entries.get(name) === pending && cache.entries.delete(name))
  }
  return cache.entries.get(name)
}

const rowsOf = (res) => (Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [])

export const getAclCatalog = (sid) => cached(sid, 'catalog', () =>
  axios.get(re(`getTableData/${sid}/SVAROG_ACL/0`)).then(checked).then(rowsOf))

export const getGroupAcl = (sid, groupId) => cached(sid, `acl:${groupId}`, () =>
  axios.get(ws(`get-acl-by-group/sid/${sid}/group_object_id/${groupId}`)).then(checked).then(rowsOf))

export const getGroupMembers = (sid, groupId) => cached(sid, `members:${groupId}`, () =>
  axios.get(ws(`getLinkedUsers/${sid}/${groupId}`)).then(checked).then(res => rowsOf(res).map(toPerson)))

const forgetGroupAcl = (groupId) => cache.entries.delete(`acl:${groupId}`)

// One code per line. Repeats stay: a revoke drops one copy of a code a group holds twice.
export const manageAcl = (sid, groupId, manage, codes) => postJson(ws(`manageCustomAcl/${sid}`), {
  manage,
  aclCode: codes.map(code => code.trim()).filter(Boolean).join('\n'),
  groupObjId: groupId
}).then(checked)

const groupCall = (sid, userId, { op, groupId }) => {
  if (op === 'default') return ws(`addDefaultUserGroup/${sid}/${userId}/${groupId}/true`)
  return ws(`updateUserGroup/${sid}/${userId}/${groupId}/${op}`)
}

const runStep = (sid, userId, step) => {
  if (step.op !== 'grant' && step.op !== 'revoke') return axios.get(groupCall(sid, userId, step)).then(checked)
  forgetGroupAcl(step.groupId)
  return manageAcl(sid, step.groupId, step.op.toUpperCase(), step.codes)
}

export const runGroupPlan = async (sid, userId, plan) => {
  let last
  for (const step of plan) {
    last = await runStep(sid, userId, step)
  }
  return last
}

export const setStatus = (sid, userId, status) =>
  axios.get(ws(`changeUserStatus/${sid}/${userId}/${status}`)).then(checked)

export const editPerson = (sid, userId, formData) => postJson(ws(`editUser/${sid}/${userId}`), formData).then(checked)

export const getLinkedTables = (sid, userType) => axios.get(re(`getLinkedTableNamesByUserObjectType/${sid}/${userType}`))
  .then(res => (Array.isArray(res.data) ? res.data : []))
  .then(tables => tables.map(table => ({ name: table?.table_name || table, label: table?.label || table?.table_name || table })))

export const searchRecords = (sid, table, formData) =>
  axios.post(re(`getObjectsByCriteria/${sid}/${table}`), formData, FORM).then(res => res.data?.data || [])

export const linkRecord = (sid, userId, table, objectId) =>
  axios.get(re(`linkObjects/${sid}/${userId}/SVAROG_USERS/${objectId}/${table}/POA`)).then(checked)

export const unlinkRecord = (sid, userId, table, objectId) =>
  axios.get(re(`dropLink/${sid}/${objectId}/${table}/${userId}/SVAROG_USERS/POA`)).then(checked)
