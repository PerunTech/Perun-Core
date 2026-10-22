import { describe, expect, it } from 'vitest'
import {
  focusableIndex, fold, matchOptions, movedIndex, selectedOptions, stringifyValue
} from '../../../../frontend/elements/base/select/options'

describe('fold', () => {
  it('lowers the case and takes the accents off Latin letters', () => {
    expect(fold('Élan Vital')).toBe('elan vital')
    expect(fold('Čair, Kičevo')).toBe('cair, kicevo')
  })

  it("leaves the letters of other scripts whole", () => {
    expect(fold('Ѓорче Петров')).toBe('ѓорче петров')
    expect(fold('Йошкар')).toBe('йошкар')
  })

  it('reads a label that is not text as text', () => {
    expect(fold(1024)).toBe('1024')
  })
})

describe('matchOptions', () => {
  const municipalities = [
    { value: 1, label: 'Čair' },
    { value: 2, label: 'Kičevo' },
    { value: 3, label: 'Ѓорче Петров' },
    { value: 4, label: 'Gazi Baba' }
  ]
  const folded = municipalities.map((option) => fold(option.label))
  const match = (inputValue, excluded) => matchOptions(municipalities, folded, inputValue, excluded).map((option) => option.value)

  it('matches the text in any case, with or without accents', () => {
    expect(match('CAIR')).toEqual([1])
    expect(match('kič')).toEqual([2])
  })

  it('asks for every word, in any order', () => {
    expect(match('baba gazi')).toEqual([4])
    expect(match('gazi kicevo')).toEqual([])
  })

  it('keeps the accents of other scripts', () => {
    expect(match('ѓорче')).toEqual([3])
    expect(match('горче')).toEqual([])
  })

  it('matches every option for no text, less the ones excluded', () => {
    expect(match('')).toEqual([1, 2, 3, 4])
    expect(match('   ')).toEqual([1, 2, 3, 4])
    expect(match('', new Set([1, 3]))).toEqual([2, 4])
    expect(match('a', new Set([4]))).toEqual([1])
  })
})

describe('selectedOptions', () => {
  const species = [{ value: 1, label: 'Cattle' }, { value: 2, label: 'Sheep' }, { value: 'GOAT', label: 'Goat' }]

  it('finds the option a single value names, compared as text', () => {
    expect(selectedOptions(1, species, false)).toEqual([species[0]])
    expect(selectedOptions('1', species, false)).toEqual([species[0]])
    expect(selectedOptions('GOAT', species, false)).toEqual([species[2]])
  })

  it('reads no option from no value or a value not offered', () => {
    expect(selectedOptions(null, species, false)).toEqual([])
    expect(selectedOptions(undefined, species, false)).toEqual([])
    expect(selectedOptions('PIG', species, false)).toEqual([])
  })

  it('takes an option given as the value for itself', () => {
    const pig = { value: 'PIG', label: 'Pig' }
    expect(selectedOptions(pig, species, false)).toEqual([pig])
    expect(selectedOptions([pig, 2], species, true)).toEqual([pig, species[1]])
  })

  it('reads a multi value from a comma separated text, an array or a single value', () => {
    expect(selectedOptions('1,GOAT', species, true)).toEqual([species[0], species[2]])
    expect(selectedOptions([2, 'GOAT'], species, true)).toEqual([species[1], species[2]])
    expect(selectedOptions(2, species, true)).toEqual([species[1]])
  })

  it('drops from a multi value what is not offered', () => {
    expect(selectedOptions('1,PIG', species, true)).toEqual([species[0]])
    expect(selectedOptions('', species, true)).toEqual([])
    expect(selectedOptions(null, species, true)).toEqual([])
    expect(selectedOptions(undefined, species, true)).toEqual([])
  })
})

describe('focusableIndex', () => {
  const visible = [{ value: 1 }, { value: 2 }, { value: 3 }]

  it('is null for an empty menu', () => {
    expect(focusableIndex([], { value: 1 })).toBeNull()
  })

  it('finds the option by its value, else the first', () => {
    expect(focusableIndex(visible, { value: 3 })).toBe(2)
    expect(focusableIndex(visible, { value: 9 })).toBe(0)
    expect(focusableIndex(visible, null)).toBe(0)
  })
})

describe('movedIndex', () => {
  const count = 12

  it('goes round past the ends for next and previous', () => {
    expect(movedIndex('next', 3, count)).toBe(4)
    expect(movedIndex('next', 11, count)).toBe(0)
    expect(movedIndex('previous', 3, count)).toBe(2)
    expect(movedIndex('previous', 0, count)).toBe(11)
  })

  it('goes to the start or the end', () => {
    expect(movedIndex('start', 7, count)).toBe(0)
    expect(movedIndex('end', 7, count)).toBe(11)
  })

  it('moves a page of five and stops at the ends', () => {
    expect(movedIndex('page_up', 7, count)).toBe(2)
    expect(movedIndex('page_up', 3, count)).toBe(0)
    expect(movedIndex('page_down', 3, count)).toBe(8)
    expect(movedIndex('page_down', 9, count)).toBe(11)
  })

  it('stays for a direction it does not know', () => {
    expect(movedIndex('sideways', 7, count)).toBe(7)
  })
})

describe('stringifyValue', () => {
  it('keeps text as it is and writes anything else as JSON', () => {
    expect(stringifyValue('1,GOAT')).toBe('1,GOAT')
    expect(stringifyValue([1, 'GOAT'])).toBe('[1,"GOAT"]')
    expect(stringifyValue({ value: 1 })).toBe('{"value":1}')
    expect(stringifyValue(0)).toBe('0')
    expect(stringifyValue(false)).toBe('false')
  })

  it('writes no value as an empty text', () => {
    expect(stringifyValue(null)).toBe('')
    expect(stringifyValue(undefined)).toBe('')
  })
})
