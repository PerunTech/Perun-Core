import React from 'react';
import PropTypes from 'prop-types';
import { Icon } from '../..';

//print btn component used in GenericGrid
const PrintButtonFormatter = ({ row, printout }) => {
  const handlePrint = (e) => {
    e.stopPropagation()
    const objectIdKey = row && Object.keys(row).find((key) => key.endsWith('.OBJECT_ID'))
    const objId = objectIdKey ? row[objectIdKey] : undefined
    let url = printout.replace('{rowObjectId}', objId)
    url = window.server + url
    window.open(url, '_blank')
  }

  return (
    <div
      className='print-button-formatter'
      onClick={handlePrint}
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', cursor: 'pointer' }}
    >
      <Icon name='IconPrinter' size={18} />
    </div>
  )
}

PrintButtonFormatter.propTypes = {
  row: PropTypes.object,
  printout: PropTypes.string
}

export default PrintButtonFormatter
