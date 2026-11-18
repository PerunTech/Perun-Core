import { useEffect, useState } from 'react'
import { alertUserResponse } from '../../../elements'
import { getAclCatalog, getAllGroups, getHolders, getTables } from './peopleApi'
import { readAclData } from './aclCatalog'

// The ACL catalog with every group's codes and the tables, read once per session and again after `reload`.
export const useAclData = (svSession, enabled = true) => {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!svSession || !enabled) return
    let cancelled = false
    Promise.all([getAclCatalog(svSession), getHolders(svSession), getAllGroups(svSession), getTables(svSession)])
      .then(([aclRows, holderRows, groups, tableRows]) => {
        if (!cancelled) setData(readAclData({ aclRows, holderRows, groups, tableRows }))
      })
      .catch(err => {
        if (cancelled) return
        setFailed(true)
        alertUserResponse({ response: err })
      })
    return () => { cancelled = true }
  }, [svSession, enabled, version])

  return { data, failed, reload: () => setVersion(count => count + 1) }
}
