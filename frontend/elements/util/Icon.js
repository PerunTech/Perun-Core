import React, { useState, useEffect } from 'react';
import { createReactComponent } from '@tabler/icons-react'
import { loadModule } from '../../functions/modules'

// The module holds arguments, not components, so the component is made here with this bundle's React,
// once per icon: a new one per render would remount the svg.
const components = new Map()

const componentFor = (icons, name) => {
  if (!components.has(name)) {
    const args = icons[name]
    components.set(name, Array.isArray(args) ? createReactComponent(...args) : null)
  }
  return components.get(name)
}

const Icon = ({ name, ...props }) => {
  const [IconComponent, setIconComponent] = useState(null)

  useEffect(() => {
    if (!name) return
    loadModule('tabler-icons-react').then((icons) => {
      setIconComponent(() => componentFor(icons, name))
    }).catch(() => setIconComponent(null))
  }, [name])

  if (!IconComponent) return null
  return <IconComponent {...props} />
}

export default Icon
