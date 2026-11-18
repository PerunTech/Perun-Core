import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import {
  createCodes, getAclCatalog, getAllGroups, getGroupMembers, getGroups, getHolders, listPeople, loadAclData, prefetchAclData,
  runGroupEdit, runGroupPlan, saveGroup,
} from '../../../../frontend/components/User Management/People/peopleApi'

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

beforeEach(() => { globalThis.window = { server: 'http://backend' } })
afterEach(() => { vi.resetAllMocks(); delete globalThis.window })

describe('peopleApi', () => {
  it('lists everyone through searchUsers with an empty username', async () => {
    axios.post.mockResolvedValue({ data: [{ 'SVAROG_USERS.OBJECT_ID': 7, 'SVAROG_USERS.USER_NAME': 'ANA' }] })
    const list = await listPeople('sid')
    expect(axios.post).toHaveBeenCalledWith('http://backend/WsAdminConsole/searchUsers/sid',
      encodeURIComponent('{"USER_NAME":""}'), expect.anything())
    expect(list[0]).toMatchObject({ id: 7, userName: 'ANA' })
  })

  it('reads an empty answer as no one', async () => {
    axios.post.mockResolvedValue({ data: '' })
    expect(await listPeople('sid')).toEqual([])
  })

  it('reads the default flag from the two-argument getLinkedGroups', async () => {
    axios.get.mockResolvedValue({ data: [{ 'SVAROG_USER_GROUPS.OBJECT_ID': 3, 'SVAROG_USER_GROUPS.GROUP_NAME': 'VETS', DEFAULTGROUP: true }] })
    expect(await getGroups('sid', 7)).toEqual([{ id: 3, name: 'VETS', labelCode: '', isDefault: true }])
    expect(axios.get).toHaveBeenCalledWith('http://backend/WsAdminConsole/getLinkedGroups/sid/7')
  })

  it('runs a plan in order and stops at the first ERROR body', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { type: 'SUCCESS' } })
      .mockResolvedValueOnce({ data: { type: 'ERROR', title: 'No' } })
    const plan = [{ op: 'remove', groupId: 1 }, { op: 'default', groupId: 2 }, { op: 'add', groupId: 1 }]
    await expect(runGroupPlan('sid', 7, plan)).rejects.toEqual({ data: { type: 'ERROR', title: 'No' } })
    expect(axios.get.mock.calls.map(call => call[0])).toEqual([
      'http://backend/WsAdminConsole/updateUserGroup/sid/7/1/remove',
      'http://backend/WsAdminConsole/addDefaultUserGroup/sid/7/2/true',
    ])
  })

  it('grants and revokes through manageCustomAcl, one code per line, repeats kept', async () => {
    axios.post.mockResolvedValue({ data: { type: 'SUCCESS' } })
    axios.get.mockResolvedValue({ data: { type: 'SUCCESS' } })
    await runGroupPlan('sid', 7, [
      { op: 'grant', groupId: 5, codes: ['ANIMAL.READ'] },
      { op: 'revoke', groupId: 5, codes: ['ANIMAL.FULL', ' ANIMAL.FULL '] },
      { op: 'remove', groupId: 6 },
    ])
    expect(axios.post.mock.calls.map(call => [call[0], JSON.parse(decodeURIComponent(call[1]))])).toEqual([
      ['http://backend/WsAdminConsole/manageCustomAcl/sid', { manage: 'GRANT', aclCode: 'ANIMAL.READ', groupObjId: 5 }],
      ['http://backend/WsAdminConsole/manageCustomAcl/sid', { manage: 'REVOKE', aclCode: 'ANIMAL.FULL\nANIMAL.FULL', groupObjId: 5 }],
    ])
    expect(axios.get).toHaveBeenCalledWith('http://backend/WsAdminConsole/updateUserGroup/sid/7/6/remove')
  })

  it('stops at a manageCustomAcl answer of type ERROR', async () => {
    axios.post.mockResolvedValue({ data: { type: 'ERROR', title: 'no_acl_found' } })
    await expect(runGroupPlan('s1', 7, [{ op: 'grant', groupId: 5, codes: ['X.READ'] }, { op: 'add', groupId: 6 }]))
      .rejects.toEqual({ data: { type: 'ERROR', title: 'no_acl_found' } })
    expect(axios.get).not.toHaveBeenCalled()
  })

  it('reads the catalog once per session, and the holders again after a grant', async () => {
    axios.get.mockResolvedValue({ data: [{ 'SVAROG_ACL.OBJECT_ID': 1 }] })
    await getAclCatalog('s2')
    await getAclCatalog('s2')
    await getHolders('s2')
    expect(axios.get).toHaveBeenCalledTimes(2)
    axios.post.mockResolvedValue({ data: { type: 'SUCCESS' } })
    await runGroupPlan('s2', 7, [{ op: 'grant', groupId: 5, codes: ['X.READ'] }])
    await getHolders('s2')
    await getAclCatalog('s3')
    expect(axios.get.mock.calls.map(call => call[0])).toEqual([
      'http://backend/ReactElements/getTableData/s2/SVAROG_ACL/0',
      'http://backend/ReactElements/getTableData/s2/SVAROG_SID_ACL/0',
      'http://backend/ReactElements/getTableData/s2/SVAROG_SID_ACL/0',
      'http://backend/ReactElements/getTableData/s3/SVAROG_ACL/0',
    ])
  })

  it('lets a read that starts during the prefetch share its requests', async () => {
    let finish
    axios.get.mockImplementation(url => (url.includes('SVAROG_ACL/')
      ? new Promise(resolve => { finish = () => resolve({ data: [{ 'SVAROG_ACL.OBJECT_ID': 1 }] }) })
      : Promise.resolve({ data: [] })))
    prefetchAclData('s9')
    const read = loadAclData('s9')
    finish()
    const [aclRows] = await read
    expect(aclRows).toEqual([{ 'SVAROG_ACL.OBJECT_ID': 1 }])
    expect(axios.get.mock.calls.map(call => call[0])).toEqual([
      'http://backend/ReactElements/getTableData/s9/SVAROG_ACL/0',
      'http://backend/ReactElements/getTableData/s9/SVAROG_SID_ACL/0',
      'http://backend/WsAdminConsole/getAllGroups/s9',
      'http://backend/ReactElements/getTableData/s9/SVAROG_TABLES/0',
    ])
  })

  it('drops a failed prefetch quietly, and the next read asks again', async () => {
    axios.get.mockRejectedValueOnce(new Error('down')).mockResolvedValue({ data: [] })
    prefetchAclData('s10')
    await new Promise(resolve => setTimeout(resolve, 0))
    await loadAclData('s10')
    expect(axios.get.mock.calls.filter(call => call[0].includes('/SVAROG_ACL/'))).toHaveLength(2)
  })

  it("reads a group's members again after someone joins it", async () => {
    axios.get.mockResolvedValue({ data: [] })
    await getGroupMembers('s4', 5)
    await getGroupMembers('s4', 5)
    axios.get.mockResolvedValueOnce({ data: { type: 'SUCCESS' } })
    await runGroupPlan('s4', 7, [{ op: 'add', groupId: 5 }])
    await getGroupMembers('s4', 5)
    expect(axios.get.mock.calls.map(call => call[0])).toEqual([
      'http://backend/WsAdminConsole/getLinkedUsers/s4/5',
      'http://backend/WsAdminConsole/updateUserGroup/s4/7/5/add',
      'http://backend/WsAdminConsole/getLinkedUsers/s4/5',
    ])
  })

  it('saves a group edit as one GRANT, then one REVOKE, and skips an empty list', async () => {
    axios.post.mockResolvedValue({ data: { type: 'SUCCESS' } })
    await runGroupEdit('s5', 9, { grant: ['A.WRITE', 'card.x'], revoke: ['A.READ', 'A.READ'] })
    await runGroupEdit('s5', 9, { grant: [], revoke: ['B.READ'] })
    expect(axios.post.mock.calls.map(call => JSON.parse(decodeURIComponent(call[1])))).toEqual([
      { manage: 'GRANT', aclCode: 'A.WRITE\ncard.x', groupObjId: 9 },
      { manage: 'REVOKE', aclCode: 'A.READ\nA.READ', groupObjId: 9 },
      { manage: 'REVOKE', aclCode: 'B.READ', groupObjId: 9 },
    ])
  })

  it('stops a group edit before the REVOKE when the GRANT fails', async () => {
    axios.post.mockResolvedValueOnce({ data: { type: 'ERROR', title: 'no_acl_found' } })
    await expect(runGroupEdit('s5', 9, { grant: ['X'], revoke: ['Y'] })).rejects.toBeTruthy()
    expect(axios.post).toHaveBeenCalledTimes(1)
  })

  it('creates codes through createCustomAcl and reads the catalog again', async () => {
    axios.get.mockResolvedValue({ data: [] })
    await getAclCatalog('s6')
    axios.post.mockResolvedValue({ data: { type: 'SUCCESS' } })
    await createCodes('s6', ['card.new_access'], 'READ')
    await getAclCatalog('s6')
    expect(axios.post).toHaveBeenCalledWith('http://backend/WsAdminConsole/createCustomAcl/s6',
      encodeURIComponent('{"aclCode":"card.new_access","accessType":"READ"}'), expect.anything())
    expect(axios.get).toHaveBeenCalledTimes(2)
  })

  it('saves a group without groupAccess and reads the group list again', async () => {
    axios.get.mockResolvedValue({ data: { data: [{ groupName: 'G', objectId: '1' }] } })
    await getAllGroups('s7')
    axios.post.mockResolvedValue({ data: { type: 'SUCCESS' } })
    await saveGroup('s7', { GROUP_NAME: 'G', E_MAIL: 'g@example.com', groupAccess: 'FULL' })
    await getAllGroups('s7')
    expect(JSON.parse(decodeURIComponent(axios.post.mock.calls[0][1]))).toEqual({ GROUP_NAME: 'G', E_MAIL: 'g@example.com' })
    expect(axios.get).toHaveBeenCalledTimes(2)
  })

  it('treats an ERROR body from saveUserGroup as a failure', async () => {
    axios.post.mockResolvedValue({ data: { type: 'ERROR', title: 'The associated field must have a value' } })
    await expect(saveGroup('s8', { GROUP_NAME: 'G' })).rejects.toBeTruthy()
  })
})
