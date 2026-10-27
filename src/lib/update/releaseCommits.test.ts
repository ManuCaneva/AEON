import { describe, expect, it } from 'vitest'
import { filterReleaseCommits } from './releaseCommits'

describe('filterReleaseCommits', () => {
  it('deja pasar feat, fix y perf, con o sin scope y breaking', () => {
    const subjects = [
      'feat(pomodoro): temporizador de estudio',
      'fix: la app abre en Wayland',
      'perf(dashboard): render más rápido',
      'feat!: nuevo esquema de notas',
      'feat(cloud)!: sincronización',
    ]

    expect(filterReleaseCommits(subjects)).toEqual(subjects)
  })

  it('descarta commits internos que al usuario no le importan', () => {
    const subjects = [
      'chore: bump de dependencias',
      'docs: typo en README',
      'test: más casos de semver',
      'refactor(db): mover queries',
      'ci: cachear rust',
      'style: prettier',
      'Merge pull request #12 from dev',
      'wip sin convención',
    ]

    expect(filterReleaseCommits(subjects)).toEqual([])
  })

  it('tolera espacios y descarta texto suelto parecido', () => {
    expect(filterReleaseCommits(['  feat: con espacios', 'feature: no es convención'])).toEqual([
      '  feat: con espacios',
    ])
  })
})
