import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ElCard, ElButton, ElForm, ElPagination, ElDialog, ElUpload } from 'element-plus'
import UniversalList from '@/components/UniversalList/index.vue'

describe('UniversalList', () => {
  const mockItems = [
    { id: 1, name: '项目1' },
    { id: 2, name: '项目2' },
    { id: 3, name: '项目3' }
  ]

  const defaultProps = {
    title: '测试列表',
    items: mockItems,
    loading: false,
    pagination: {
      page: 1,
      size: 10,
      total: 30
    },
    searchForm: {},
    selectedIds: [],
    cardMode: 'product' as const,
    idField: 'id',
    importColumns: ['列1', '列2', '列3'],
    emptyText: '暂无数据'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基础渲染', () => {
    it('应该正确渲染列表标题', () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps
      })

      expect(wrapper.find('.card-header span').text()).toBe('测试列表')
    })

    it('应该正确渲染卡片', () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps
      })

      const cards = wrapper.findAll('.universal-card')
      expect(cards.length).toBe(3)
    })

    it('应该显示加载状态', () => {
      const wrapper = mount(UniversalList, {
        props: {
          ...defaultProps,
          loading: true
        }
      })

      expect(wrapper.find('.el-loading-mask').exists()).toBe(true)
    })

    it('应该显示空状态', () => {
      const wrapper = mount(UniversalList, {
        props: {
          ...defaultProps,
          items: []
        }
      })

      expect(wrapper.find('.el-empty').exists()).toBe(true)
      expect(wrapper.find('.el-empty').text()).toContain('暂无数据')
    })
  })

  describe('按钮显示', () => {
    it('默认应该显示添加、导入、下载、删除按钮', () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps
      })

      const buttons = wrapper.findAllComponents(ElButton)
      expect(buttons.length).toBeGreaterThanOrEqual(4)
    })

    it('应该显示回收站按钮当showRecycleBinButton为true时', () => {
      const wrapper = mount(UniversalList, {
        props: {
          ...defaultProps,
          showRecycleBinButton: true
        }
      })

      const recycleBinButton = wrapper.findAllComponents(ElButton).find(
        btn => btn.props('type') === 'warning'
      )
      expect(recycleBinButton).toBeTruthy()
    })

    it('不应该显示添加按钮当showAddButton为false时', () => {
      const wrapper = mount(UniversalList, {
        props: {
          ...defaultProps,
          showAddButton: false
        }
      })

      const addButton = wrapper.findAllComponents(ElButton).find(
        btn => btn.props('type') === 'primary'
      )
      expect(addButton).toBeFalsy()
    })

    it('不应该显示导入按钮当showImportButton为false时', () => {
      const wrapper = mount(UniversalList, {
        props: {
          ...defaultProps,
          showImportButton: false
        }
      })

      const importButton = wrapper.findAllComponents(ElButton).find(
        btn => btn.props('type') === 'success'
      )
      expect(importButton).toBeFalsy()
    })

    it('不应该显示下载按钮当showDownloadButton为false时', () => {
      const wrapper = mount(UniversalList, {
        props: {
          ...defaultProps,
          showDownloadButton: false
        }
      })

      const downloadButton = wrapper.findAllComponents(ElButton).find(
        btn => btn.props('type') === 'info'
      )
      expect(downloadButton).toBeFalsy()
    })
  })

  describe('按钮事件', () => {
    it('点击添加按钮应该触发add事件', async () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps
      })

      const addButton = wrapper.findAllComponents(ElButton).find(
        btn => btn.props('type') === 'primary'
      )
      await addButton?.trigger('click')

      expect(wrapper.emitted('add')).toBeTruthy()
    })

    it('点击导入按钮应该触发import事件', async () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps
      })

      const importButton = wrapper.findAllComponents(ElButton).find(
        btn => btn.props('type') === 'success'
      )
      await importButton?.trigger('click')

      expect(wrapper.emitted('import')).toBeTruthy()
    })

    it('点击下载模板按钮应该触发download-template事件', async () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps
      })

      const downloadButton = wrapper.findAllComponents(ElButton).find(
        btn => btn.props('type') === 'info'
      )
      await downloadButton?.trigger('click')

      expect(wrapper.emitted('download-template')).toBeTruthy()
    })

    it('点击回收站按钮应该触发recycle-bin事件', async () => {
      const wrapper = mount(UniversalList, {
        props: {
          ...defaultProps,
          showRecycleBinButton: true
        }
      })

      const recycleBinButton = wrapper.findAllComponents(ElButton).find(
        btn => btn.props('type') === 'warning'
      )
      await recycleBinButton?.trigger('click')

      expect(wrapper.emitted('recycle-bin')).toBeTruthy()
    })

    it('点击批量删除按钮应该触发batch-delete事件', async () => {
      const wrapper = mount(UniversalList, {
        props: {
          ...defaultProps,
          selectedIds: [1, 2]
        }
      })

      const deleteButton = wrapper.findAllComponents(ElButton).find(
        btn => btn.props('type') === 'danger'
      )
      await deleteButton?.trigger('click')

      expect(wrapper.emitted('batch-delete')).toBeTruthy()
    })

    it('批量删除按钮应该在没有选中项时禁用', () => {
      const wrapper = mount(UniversalList, {
        props: {
          ...defaultProps,
          selectedIds: []
        }
      })

      const deleteButton = wrapper.findAllComponents(ElButton).find(
        btn => btn.props('type') === 'danger'
      )
      expect(deleteButton?.props('disabled')).toBe(true)
    })
  })

  describe('分页功能', () => {
    it('应该正确显示分页信息', () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps
      })

      const pagination = wrapper.findComponent(ElPagination)
      expect(pagination.props('currentPage')).toBe(1)
      expect(pagination.props('pageSize')).toBe(10)
      expect(pagination.props('total')).toBe(30)
    })

    it('应该显示每页显示选择器', () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps
      })

      expect(wrapper.find('.page-size-selector').exists()).toBe(true)
      expect(wrapper.find('.page-size-selector label').text()).toBe('每页显示：')
    })

    it('改变每页显示数量应该触发size-change事件', async () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps
      })

      const pagination = wrapper.findComponent(ElPagination)
      await pagination.vm.$emit('size-change', 20)

      expect(wrapper.emitted('size-change')).toBeTruthy()
      expect(wrapper.emitted('size-change')![0]).toEqual([20])
    })

    it('改变页码应该触发page-change事件', async () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps
      })

      const pagination = wrapper.findComponent(ElPagination)
      await pagination.vm.$emit('current-change', 2)

      expect(wrapper.emitted('page-change')).toBeTruthy()
      expect(wrapper.emitted('page-change')![0]).toEqual([2])
    })
  })

  describe('导入对话框', () => {
    it('点击导入按钮应该显示对话框', async () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps
      })

      const importButton = wrapper.findAllComponents(ElButton).find(
        btn => btn.props('type') === 'success'
      )
      await importButton?.trigger('click')

      expect(wrapper.findComponent(ElDialog).props('modelValue')).toBe(true)
    })

    it('应该显示导入列名说明', () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps
      })

      const dialog = wrapper.findComponent(ElDialog)
      dialog.vm.modelValue = true

      expect(wrapper.text()).toContain('列1')
      expect(wrapper.text()).toContain('列2')
      expect(wrapper.text()).toContain('列3')
    })

    it('应该显示上传组件', () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps
      })

      const dialog = wrapper.findComponent(ElDialog)
      dialog.vm.modelValue = true

      expect(wrapper.findComponent(ElUpload).exists()).toBe(true)
    })
  })

  describe('搜索表单', () => {
    it('应该显示搜索表单', () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps
      })

      expect(wrapper.findComponent(ElForm).exists()).toBe(true)
    })

    it('应该渲染搜索表单插槽内容', () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps,
        slots: {
          'search-form': '<div class="custom-search">自定义搜索</div>'
        }
      })

      expect(wrapper.find('.custom-search').exists()).toBe(true)
    })
  })

  describe('卡片事件', () => {
    it('应该正确传递卡片事件', async () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps
      })

      const card = wrapper.findComponent({ name: 'UniversalCard' })
      await card.vm.$emit('click', mockItems[0])

      expect(wrapper.emitted('card-click')).toBeTruthy()
      expect(wrapper.emitted('card-click')![0]).toEqual([mockItems[0]])
    })

    it('应该正确传递选中事件', async () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps
      })

      const card = wrapper.findComponent({ name: 'UniversalCard' })
      await card.vm.$emit('select', 1, true)

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')![0]).toEqual([1, true])
    })

    it('应该正确传递查看事件', async () => {
      const wrapper = mount(UniversalList, {
        props: {
          ...defaultProps,
          cardMode: 'selection' as const
        }
      })

      const card = wrapper.findComponent({ name: 'UniversalCard' })
      await card.vm.$emit('view', mockItems[0])

      expect(wrapper.emitted('view')).toBeTruthy()
      expect(wrapper.emitted('view')![0]).toEqual([mockItems[0]])
    })

    it('应该正确传递删除事件', async () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps
      })

      const card = wrapper.findComponent({ name: 'UniversalCard' })
      await card.vm.$emit('delete', mockItems[0])

      expect(wrapper.emitted('delete')).toBeTruthy()
      expect(wrapper.emitted('delete')![0]).toEqual([mockItems[0]])
    })
  })

  describe('自定义属性', () => {
    it('应该使用自定义添加按钮文本', () => {
      const wrapper = mount(UniversalList, {
        props: {
          ...defaultProps,
          addButtonText: '新建项目'
        }
      })

      const addButton = wrapper.findAllComponents(ElButton).find(
        btn => btn.props('type') === 'primary'
      )
      expect(addButton?.text()).toBe('新建项目')
    })

    it('应该使用自定义空状态文本', () => {
      const wrapper = mount(UniversalList, {
        props: {
          ...defaultProps,
          items: [],
          emptyText: '没有找到任何项目'
        }
      })

      expect(wrapper.find('.el-empty').text()).toContain('没有找到任何项目')
    })
  })

  describe('响应式布局', () => {
    it('应该正确应用网格布局', () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps
      })

      const grid = wrapper.find('.list-grid')
      expect(grid.exists()).toBe(true)
    })

    it('应该正确应用分页容器布局', () => {
      const wrapper = mount(UniversalList, {
        props: defaultProps
      })

      const paginationContainer = wrapper.find('.pagination-container')
      expect(paginationContainer.exists()).toBe(true)
    })
  })
})
