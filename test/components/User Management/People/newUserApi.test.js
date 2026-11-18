import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { createUser, findPerson } from '../../../../frontend/components/User Management/People/peopleApi'

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

beforeEach(() => { globalThis.window = { server: 'http://backend' } })
afterEach(() => { vi.resetAllMocks(); delete globalThis.window })

describe('new user calls', () => {
  it('finds a new user by the exact username, whatever its case', async () => {
    axios.post.mockResolvedValue({ data: [
      { 'SVAROG_USERS.OBJECT_ID': 7, 'SVAROG_USERS.USER_NAME': 'ANA_K' },
      { 'SVAROG_USERS.OBJECT_ID': 8, 'SVAROG_USERS.USER_NAME': 'ANA' },
    ] })
    expect(await findPerson('sid', 'ana')).toMatchObject({ id: 8, userName: 'ANA' })
    expect(axios.post).toHaveBeenCalledWith('http://backend/WsAdminConsole/searchUsers/sid',
      encodeURIComponent('{"USER_NAME":"ana"}'), expect.anything())
    expect(await findPerson('sid', 'BO')).toBeUndefined()
  })

  it('saves a new user through saveUser and treats an ERROR body as a failure', async () => {
    axios.post.mockResolvedValueOnce({ data: { type: 'SUCCESS' } })
    await createUser('sid', { USER_NAME: 'ANA', PIN: '' })
    expect(axios.post).toHaveBeenCalledWith('http://backend/WsAdminConsole/saveUser/sid',
      encodeURIComponent('{"USER_NAME":"ANA","PIN":""}'), expect.anything())
    axios.post.mockResolvedValueOnce({ data: { type: 'ERROR', title: 'system.error.user_exists' } })
    await expect(createUser('sid', { USER_NAME: 'ANA' })).rejects.toEqual({ data: { type: 'ERROR', title: 'system.error.user_exists' } })
  })
})
