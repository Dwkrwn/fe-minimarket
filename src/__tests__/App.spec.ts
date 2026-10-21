import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import App from '../App.vue'

describe('App', () => {
  it('mounts renders properly', () => {
    const wrapper = mount(App)
    // Updated expectation to reflect current heading text in App.vue
    expect(wrapper.text()).toContain('Tailwind + shadcn-vue terpasang')
    // Ensure the new VS Code blue hex appears
    expect(wrapper.text()).toContain('#007ACC')
  })
})
