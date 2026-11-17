import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import {
  getAclCatalog, getGroupAcl, getGroups, listPeople, runGroupPlan,
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

  it('reads the catalog once per session, and a group\'s ACLs again after editing them', async () => {
    axios.get.mockResolvedValue({ data: [{ 'SVAROG_ACL.OBJECT_ID': 1 }] })
    await getAclCatalog('s2')
    await getAclCatalog('s2')
    await getGroupAcl('s2', 5)
    expect(axios.get).toHaveBeenCalledTimes(2)
    axios.post.mockResolvedValue({ data: { type: 'SUCCESS' } })
    await runGroupPlan('s2', 7, [{ op: 'grant', groupId: 5, codes: ['X.READ'] }])
    await getGroupAcl('s2', 5)
    await getAclCatalog('s3')
    expect(axios.get.mock.calls.map(call => call[0])).toEqual([
      'http://backend/ReactElements/getTableData/s2/SVAROG_ACL/0',
      'http://backend/WsAdminConsole/get-acl-by-group/sid/s2/group_object_id/5',
      'http://backend/WsAdminConsole/get-acl-by-group/sid/s2/group_object_id/5',
      'http://backend/ReactElements/getTableData/s3/SVAROG_ACL/0',
    ])
  })
})
