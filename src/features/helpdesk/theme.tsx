import { THEMES, type HelpdeskTheme } from './theme-preference'

export function ThemeSelector({
  theme,
  onChange,
}: {
  theme: HelpdeskTheme
  onChange: (value: string) => void
}) {
  return (
    <label className='theme-selector'>
      <span>色系</span>
      <select
        aria-label='介面色系'
        value={theme}
        onChange={(event) => onChange(event.target.value)}
      >
        {THEMES.map(({ id, name }) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  )
}
