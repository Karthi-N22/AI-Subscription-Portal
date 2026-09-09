const chipTones = ['violet', 'coral', 'rose', 'orange', 'blue', 'mint']

export function chipTone(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  return chipTones[hash % chipTones.length]
}
