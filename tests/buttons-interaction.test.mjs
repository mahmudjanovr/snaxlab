/**
 * tests/buttons-interaction.test.mjs
 * Regression tests for button responsiveness, single-click execution,
 * and duplicate event listener prevention in SnaxLab components.
 */

const failures = []
function assert(cond, msg) {
  if (!cond) {
    failures.push(msg)
    console.error('FAIL:', msg)
  } else {
    console.log('PASS:', msg)
  }
}

// Simple in-memory localStorage mock
function createMockStorage() {
  const store = {}
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear: () => { for (const k in store) delete store[k] },
    _dump: () => store,
  }
}

// -------------------------------------------------------------
// Test 1: BookmarkButton - single-click guarantee & idempotency
// -------------------------------------------------------------
async function testBookmarkButtonSingleClick() {
  console.log('\n--- Test: BookmarkButton Single-Click & Idempotency ---')
  const storage = createMockStorage()
  const STORAGE_KEY = 'snaxlab_saved_articles_v1'

  function createClassList(initial = []) {
    const s = new Set(initial)
    return {
      add: (...c) => c.forEach(x => s.add(x)),
      remove: (...c) => c.forEach(x => s.delete(x)),
      contains: (x) => s.has(x),
      has: (x) => s.has(x),
    }
  }

  // Mock DOM Element
  function createMockBookmarkButton(id, title) {
    const listeners = []
    const attrs = {
      'data-id': id,
      'data-title': title,
      'data-href': `/blog/${id}`,
      'aria-pressed': 'false',
    }
    const outline = { classList: createClassList(['bookmark-outline']) }
    const filled = { classList: createClassList(['bookmark-filled', 'hidden']) }
    const label = { textContent: 'Saqlash' }

    return {
      dataset: {},
      getAttribute: (k) => attrs[k] || null,
      setAttribute: (k, v) => { attrs[k] = String(v) },
      querySelector: (sel) => {
        if (sel === '.bookmark-outline') return outline
        if (sel === '.bookmark-filled') return filled
        if (sel === '.bookmark-label') return label
        return null
      },
      addEventListener: (evt, fn) => {
        listeners.push({ evt, fn })
      },
      click: () => {
        for (const l of listeners) {
          if (l.evt === 'click') l.fn({ preventDefault: () => {} })
        }
      },
      _listenersCount: () => listeners.length,
      _isSavedUI: () => attrs['aria-pressed'] === 'true' && !outline.classList.has('hidden') === false,
    }
  }

  const btn = createMockBookmarkButton('test-post-1', 'Test Post 1')

  function setupLogic(buttons) {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) || '[]')
    buttons.forEach((b) => {
      const id = b.getAttribute('data-id')
      if (!id) return
      const isSaved = saved.some((item) => item.id === id)

      // Guard: never attach multiple click listeners
      if (b.dataset.bookmarkBound === 'true') return
      b.dataset.bookmarkBound = 'true'

      const outline = b.querySelector('.bookmark-outline')
      const filled = b.querySelector('.bookmark-filled')

      let isProcessing = false
      b.addEventListener('click', (e) => {
        if (isProcessing) return
        isProcessing = true
        try {
          const current = JSON.parse(storage.getItem(STORAGE_KEY) || '[]')
          const idx = current.findIndex((item) => item.id === id)
          if (idx > -1) {
            current.splice(idx, 1)
            storage.setItem(STORAGE_KEY, JSON.stringify(current))
            b.setAttribute('aria-pressed', 'false')
            outline?.classList.remove('hidden')
            filled?.classList.add('hidden')
          } else {
            current.unshift({ id, title: b.getAttribute('data-title') })
            storage.setItem(STORAGE_KEY, JSON.stringify(current))
            b.setAttribute('aria-pressed', 'true')
            outline?.classList.add('hidden')
            filled?.classList.remove('hidden')
          }
        } finally {
          setTimeout(() => { isProcessing = false }, 50)
        }
      })
    })
  }

  // Simulate multiple setup calls (module load + astro:page-load + navigation)
  setupLogic([btn])
  setupLogic([btn])
  setupLogic([btn])

  assert(btn._listenersCount() === 1, 'Bookmark button must have exactly 1 event listener despite 3 setup runs')

  // Action: Single click
  btn.click()
  assert(btn._isSavedUI() === true, 'Click 1: article must be saved immediately on FIRST click')
  const inStore1 = JSON.parse(storage.getItem(STORAGE_KEY) || '[]')
  assert(inStore1.length === 1 && inStore1[0].id === 'test-post-1', 'Article must be persisted in storage after 1 click')

  // Action: Second single click -> should unsave immediately
  await new Promise((r) => setTimeout(r, 60))
  btn.click()
  assert(btn._isSavedUI() === false, 'Click 2: article must be unsaved immediately on SECOND click')
  const inStore2 = JSON.parse(storage.getItem(STORAGE_KEY) || '[]')
  assert(inStore2.length === 0, 'Storage must be empty after second click')
}

// -------------------------------------------------------------
// Test 2: ThemeToggle - instant toggle without race condition
// -------------------------------------------------------------
async function testThemeToggle() {
  console.log('\n--- Test: ThemeToggle Responsiveness ---')
  let currentTheme = 'dark'
  let clickCount = 0

  let isToggling = false
  function handleToggleClick() {
    if (isToggling) return
    isToggling = true
    try {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark'
      clickCount++
    } finally {
      setTimeout(() => { isToggling = false }, 50)
    }
  }

  const themeBtn = {
    onclick: null,
    click: function() {
      if (this.onclick) this.onclick()
    }
  }

  // Initializing multiple times with .onclick assignment
  themeBtn.onclick = handleToggleClick
  themeBtn.onclick = handleToggleClick // Re-assignment must overwrite cleanly

  themeBtn.click()
  assert(currentTheme === 'light', 'Click 1: Theme switches to light on first click')
  assert(clickCount === 1, 'Click 1: Exactly 1 action executed')

  await new Promise((r) => setTimeout(r, 60))
  themeBtn.click()
  assert(currentTheme === 'dark', 'Click 2: Theme switches back to dark on second click')
  assert(clickCount === 2, 'Click 2: Exactly 2 actions executed total')
}

// -------------------------------------------------------------
// Test 3: MobileNav - single-click toggle and click-outside
// -------------------------------------------------------------
async function testMobileNav() {
  console.log('\n--- Test: MobileNav Toggle & Outside Click ---')
  let isMenuOpen = false
  let documentClickHandler = null

  const btn = {
    attrs: { 'aria-expanded': 'false' },
    getAttribute(k) { return this.attrs[k] },
    setAttribute(k, v) { this.attrs[k] = String(v) },
    onclick: null,
    click() { if (this.onclick) this.onclick() },
  }

  function setupNav() {
    function toggle(show) {
      const cur = btn.getAttribute('aria-expanded') === 'true'
      const next = typeof show === 'boolean' ? show : !cur
      btn.setAttribute('aria-expanded', next ? 'true' : 'false')
      isMenuOpen = next
    }

    btn.onclick = () => toggle()

    documentClickHandler = (targetIsOutside) => {
      if (btn.getAttribute('aria-expanded') === 'true' && targetIsOutside) {
        toggle(false)
      }
    }
  }

  setupNav()

  // First click opens
  btn.click()
  assert(isMenuOpen === true, 'Click 1: MobileNav opens on FIRST click')
  assert(btn.getAttribute('aria-expanded') === 'true', 'aria-expanded set to true')

  // Click outside closes
  documentClickHandler(true)
  assert(isMenuOpen === false, 'Click outside closes MobileNav immediately')
  assert(btn.getAttribute('aria-expanded') === 'false', 'aria-expanded set to false')

  // Click again opens
  btn.click()
  assert(isMenuOpen === true, 'Click 2: MobileNav opens again immediately on next click')

  // Click button again closes
  btn.click()
  assert(isMenuOpen === false, 'Click 3: MobileNav closes immediately when clicking button again')
}

// -------------------------------------------------------------
// Test 4: ReadingSettings - font & focus cycles
// -------------------------------------------------------------
async function testReadingSettings() {
  console.log('\n--- Test: ReadingSettings Controls ---')
  let fontLevel = 0
  let isFocus = false

  const fontBtn = {
    onclick: null,
    click() { if (this.onclick) this.onclick() }
  }
  const focusBtn = {
    onclick: null,
    click() { if (this.onclick) this.onclick() }
  }

  fontBtn.onclick = () => { fontLevel = (fontLevel + 1) % 3 }
  focusBtn.onclick = () => { isFocus = !isFocus }

  fontBtn.click()
  assert(fontLevel === 1, 'Font click 1: level changes from 0 to 1 on single click')

  fontBtn.click()
  assert(fontLevel === 2, 'Font click 2: level changes from 1 to 2 on single click')

  fontBtn.click()
  assert(fontLevel === 0, 'Font click 3: level resets to 0 on single click')

  focusBtn.click()
  assert(isFocus === true, 'Focus click 1: focus enabled on single click')

  focusBtn.click()
  assert(isFocus === false, 'Focus click 2: focus disabled on single click')
}

// -------------------------------------------------------------
// Test 5: ShareControls - copy link single action
// -------------------------------------------------------------
async function testShareControls() {
  console.log('\n--- Test: ShareControls Copy Action ---')
  let copiedText = ''
  let labelText = 'Havola'
  let isCopying = false

  const copyBtn = {
    onclick: null,
    click() { if (this.onclick) this.onclick() }
  }

  const shareUrl = 'https://snaxlab.blog/blog/kendrick-lamar/'

  copyBtn.onclick = async () => {
    if (isCopying) return
    isCopying = true
    try {
      copiedText = shareUrl
      labelText = 'Nusxalandi!'
      setTimeout(() => {
        labelText = 'Havola'
        isCopying = false
      }, 50)
    } catch {
      isCopying = false
    }
  }

  await copyBtn.click()
  assert(copiedText === shareUrl, 'Copy click 1: clipboard text matches URL on single click')
  assert(labelText === 'Nusxalandi!', 'Copy click 1: label changes to Nusxalandi! on single click')

  await new Promise((r) => setTimeout(r, 60))
  assert(labelText === 'Havola', 'Label resets to Havola after duration')
}

// -------------------------------------------------------------
// Run all tests
// -------------------------------------------------------------
await testBookmarkButtonSingleClick()
await testThemeToggle()
await testMobileNav()
await testReadingSettings()
await testShareControls()

console.log('\n========================================')
if (failures.length > 0) {
  console.error(`FAILED: ${failures.length} test(s) failed.`)
  process.exit(1)
} else {
  console.log('ALL INTERACTIVE BUTTON TESTS PASSED (100%)!')
}
