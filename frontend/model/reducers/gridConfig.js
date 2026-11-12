export default function gridConfig(state = {
  gridHierarchy: []
}, action) {
  switch (action.type) {
    case 'ADDGRID': {
      let currGrids
      if (!state[action.group]) {
        currGrids = []
      } else {
        currGrids = state[action.group]
        for (const key in currGrids) {
          const value = currGrids[key]
          if (value.id === action.id) {
            currGrids.splice(key, 1)
          }
        }
      }
      currGrids.push({
        id: action.id,
        grid: action.payload
      })

      return { ...state, [action.group]: currGrids }
    }
    case 'REMOVEGRID': {
      let currGrids
      if (!state[action.group]) {
        currGrids = []
      } else {
        currGrids = state[action.group]
        if (currGrids !== undefined) {
          for (const key in currGrids) {
            const value = currGrids[key]
            if (value.id === action.id) {
              currGrids.splice(key, 1)
            }
          }
        }
      }
      return { ...state, [action.group]: currGrids }
    }

    case 'CLEAN_GRIDS': {
      return { ...state, [action.group]: undefined }
    }

    case 'ADD_LAST_SELECTED_ITEM': {
      let gridType = removeNumbersFromStringAndCutWhereFirstNumIsFound(action.payload[0])
      const lastSelectedItem = {
        gridType: gridType,
        gridId: action.payload[0],
        row: action.payload[1],
        config: action.payload[2],
        active: true
      }
      const allGrids = state.gridHierarchy
      for (let i = 0; i < allGrids.length; i++) {
        // Only the newly selected item stays active.
        if (allGrids[i].gridId === lastSelectedItem.gridId) {
          allGrids[i].active = true
        } else {
          allGrids[i].active = false
        }
        // A newer object of the same core type replaces the old one.
        let oldCoreType = allGrids[i].gridType
        let newCoreType = lastSelectedItem.gridType
        if (oldCoreType === newCoreType) {
          allGrids.splice(i, 1)
        }
      }
      if (!allGrids.some((element) => {
        return lastSelectedItem.gridId === element.gridId
      })) {
        allGrids.push(lastSelectedItem)
      }
      return { ...state, gridHierarchy: allGrids }
    }

    case 'SWITCH_SELECTED_ITEM': {
      const gridId = action.payload
      const gridHierarchy = state.gridHierarchy
      if (gridHierarchy.length > 0) {
        for (let i = 0; i < gridHierarchy.length; i++) {
          if (gridHierarchy[i].gridId === gridId) {
            gridHierarchy[i].active = true
          } else {
            gridHierarchy[i].active = false
          }
        }
      }
      return { ...state, gridHierarchy: gridHierarchy }
    }

    case 'CLEAN_ALL_SELECTED_ITEMS': {
      return { ...state, gridHierarchy: [] }
    }

    case 'REPLACE_ALL_SELECTED_ITEMS': {
      return { ...state, gridHierarchy: action.payload }
    }

    default: {
      return state
    }
  }
}

function removeNumbersFromStringAndCutWhereFirstNumIsFound(string) {
  let formattedString = string.split('_')
  if (formattedString.length > 1) {
    for (let j = 0; j < formattedString.length; j++) {
      if (!isNaN(parseFloat(formattedString[j + 1]))) {
        formattedString = formattedString.slice(0, j + 1)
        break
      }
    }
  }
  formattedString = formattedString.join()
  formattedString = formattedString.replace(/,/g, '_')
  return formattedString
}
