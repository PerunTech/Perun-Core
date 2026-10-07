import React, { useState, useEffect } from 'react';
import { createReactComponent } from '@tabler/icons-react'
import { loadModule } from '../../functions/modules'

/**
 * Each icon's component, made once.
 *
 * The icon set is loaded on demand and holds each icon's arguments rather than its component, so
 * that it carries no React of its own (see build/modules.mjs). The component is made here, with
 * this bundle's React, and kept: a new one on every render would remount the svg each time.
 */
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
