import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ElCheckbox, ElButton, ElImage, ElTag, ElIcon } from 'element-plus'
import UniversalCard from '@/components/UniversalCard/index.vue'

describe('UniversalCard', () => {
  const mockProduct = {
    sku: 'SKU001',
    name: '测试产品',
    image: '/images/test.jpg',
    type: '普通产品',
    createdAt: '2026-01-01T00:00:00Z'
  }

  const mockSelection = {
    id: 1,
    asin: 'B001',
    productTitle: '测试选品',
    productType: 'new',
    price: '99.99',
    storeName: '测试店铺',
    category: '电子产品',
    tags: ['标签1', '标签2', '标签3', '标签4'],
    createdAt: '2026-01-01T00:00:00Z'
  }

  describe('产品模式', () => {
    it('应该正确渲染产品卡片', () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockProduct,
          mode: 'product'
        }
      })

      expect(wrapper.find('.card-id').text()).toBe('SKU001')
      expect(wrapper.find('.card-title').text()).toBe('测试产品')
    })

    it('应该显示产品类型标签', () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockProduct,
          mode: 'product'
        }
      })

      const typeTag = wrapper.find('.card-type-tag .el-tag')
      expect(typeTag.exists()).toBe(true)
      expect(typeTag.text()).toBe('普通产品')
    })

    it('选中状态应该正确显示', async () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockProduct,
          mode: 'product',
          selected: false
        }
      })

      expect(wrapper.find('.universal-card.selected').exists()).toBe(false)

      await wrapper.setProps({ selected: true })
      expect(wrapper.find('.universal-card.selected').exists()).toBe(true)
    })

    it('点击卡片应该触发click事件', async () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockProduct,
          mode: 'product'
        }
      })

      await wrapper.find('.universal-card').trigger('click')
      expect(wrapper.emitted('click')).toBeTruthy()
      expect(wrapper.emitted('click')![0]).toEqual([mockProduct])
    })
  })

  describe('选品模式', () => {
    it('应该正确渲染选品卡片', () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockSelection,
          mode: 'selection'
        }
      })

      expect(wrapper.find('.card-id').text()).toBe('B001')
      expect(wrapper.find('.card-title').text()).toBe('测试选品')
    })

    it('应该显示价格信息', () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockSelection,
          mode: 'selection'
        }
      })

      const priceElement = wrapper.find('.meta-item .meta-value')
      expect(priceElement.text()).toBe('¥99.99')
    })

    it('应该显示店铺名称', () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockSelection,
          mode: 'selection'
        }
      })

      const storeElement = wrapper.findAll('.meta-item .meta-value')[1]
      expect(storeElement.text()).toBe('测试店铺')
    })

    it('应该显示分类信息', () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockSelection,
          mode: 'selection'
        }
      })

      const categoryElement = wrapper.findAll('.meta-item .meta-value')[2]
      expect(categoryElement.text()).toBe('电子产品')
    })

    it('应该显示标签（最多3个+更多）', () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockSelection,
          mode: 'selection'
        }
      })

      const tags = wrapper.findAll('.card-tags .el-tag')
      expect(tags.length).toBe(4) // 3个标签 + 1个"+1"
      expect(tags[3].text()).toBe('+1')
    })

    it('应该显示类型徽章', () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockSelection,
          mode: 'selection'
        }
      })

      const typeBadge = wrapper.find('.card-type-badge')
      expect(typeBadge.exists()).toBe(true)
      expect(typeBadge.text()).toBe('新品')
      expect(typeBadge.classes()).toContain('new')
    })

    it('应该显示创建时间', () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockSelection,
          mode: 'selection'
        }
      })

      const timeElement = wrapper.find('.create-time')
      expect(timeElement.exists()).toBe(true)
    })
  })

  describe('复选框功能', () => {
    it('应该显示复选框', () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockProduct,
          mode: 'product'
        }
      })

      const checkbox = wrapper.findComponent(ElCheckbox)
      expect(checkbox.exists()).toBe(true)
    })

    it('选中复选框应该触发select事件', async () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockProduct,
          mode: 'product'
        }
      })

      const checkbox = wrapper.findComponent(ElCheckbox)
      await checkbox.vm.$emit('change', true)

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')![0]).toEqual(['SKU001', true])
    })

    it('取消选中复选框应该触发select事件', async () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockProduct,
          mode: 'product',
          selected: true
        }
      })

      const checkbox = wrapper.findComponent(ElCheckbox)
      await checkbox.vm.$emit('change', false)

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')![0]).toEqual(['SKU001', false])
    })
  })

  describe('删除按钮', () => {
    it('应该显示删除按钮', () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockProduct,
          mode: 'product'
        }
      })

      const deleteButtons = wrapper.findAllComponents(ElButton).filter(
        btn => btn.props('type') === 'danger'
      )
      expect(deleteButtons.length).toBe(1)
    })

    it('点击删除按钮应该触发delete事件', async () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockProduct,
          mode: 'product'
        }
      })

      const deleteButton = wrapper.findAllComponents(ElButton).find(
        btn => btn.props('type') === 'danger'
      )
      await deleteButton?.trigger('click')

      expect(wrapper.emitted('delete')).toBeTruthy()
      expect(wrapper.emitted('delete')![0]).toEqual([mockProduct])
    })

    it('删除按钮应该阻止事件冒泡', async () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockProduct,
          mode: 'product'
        }
      })

      const deleteButton = wrapper.findAllComponents(ElButton).find(
        btn => btn.props('type') === 'danger'
      )
      await deleteButton?.trigger('click')

      expect(wrapper.emitted('click')).toBeFalsy()
    })
  })

  describe('查看按钮', () => {
    it('选品模式应该显示查看按钮', () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockSelection,
          mode: 'selection'
        }
      })

      const viewButtons = wrapper.findAllComponents(ElButton).filter(
        btn => btn.props('type') === 'primary'
      )
      expect(viewButtons.length).toBe(1)
    })

    it('产品模式不应该显示查看按钮', () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockProduct,
          mode: 'product'
        }
      })

      const viewButtons = wrapper.findAllComponents(ElButton).filter(
        btn => btn.props('type') === 'primary'
      )
      expect(viewButtons.length).toBe(0)
    })

    it('点击查看按钮应该触发view事件', async () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockSelection,
          mode: 'selection'
        }
      })

      const viewButton = wrapper.findAllComponents(ElButton).find(
        btn => btn.props('type') === 'primary'
      )
      await viewButton?.trigger('click')

      expect(wrapper.emitted('view')).toBeTruthy()
      expect(wrapper.emitted('view')![0]).toEqual([mockSelection])
    })
  })

  describe('图片处理', () => {
    it('应该正确渲染图片', () => {
      const wrapper = mount(UniversalCard, {
        props: {
          product: mockProduct,
          mode: 'product'
        }
      })

      const image = wrapper.findComponent(ElImage)
      expect(image.props('src')).toBe('/images/test.jpg')
    })

    it('应该使用默认图片当没有图片时', () => {
      const productWithoutImage = { ...mockProduct, image: undefined }
      const wrapper = mount(UniversalCard, {
        props: {
          product: productWithoutImage,
          mode: 'product'
        }
      })

      const image = wrapper.findComponent(ElImage)
      expect(image.props('src')).toBe('/images/default.png')
    })

    it('应该优先使用thumbPath', () => {
      const productWithThumb = {
        ...mockProduct,
        thumbPath: 'thumb.jpg',
        image: 'image.jpg'
      }
      const wrapper = mount(UniversalCard, {
        props: {
          product: productWithThumb,
          mode: 'product'
        }
      })

      const image = wrapper.findComponent(ElImage)
      expect(image.props('src')).toBe('/images/thumb.jpg')
    })
  })

  describe('时间格式化', () => {
    it('应该格式化刚刚创建的时间', () => {
      const now = new Date()
      const recentProduct = {
        ...mockProduct,
        createdAt: now.toISOString()
      }
      const wrapper = mount(UniversalCard, {
        props: {
          product: recentProduct,
          mode: 'selection'
        }
      })

      const timeElement = wrapper.find('.create-time')
      expect(timeElement.text()).toBe('刚刚')
    })

    it('应该格式化小时前的时间', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
      const product = {
        ...mockProduct,
        createdAt: twoHoursAgo.toISOString()
      }
      const wrapper = mount(UniversalCard, {
        props: {
          product: product,
          mode: 'selection'
        }
      })

      const timeElement = wrapper.find('.create-time')
      expect(timeElement.text()).toBe('2小时前')
    })

    it('应该格式化天前的时间', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      const product = {
        ...mockProduct,
        createdAt: threeDaysAgo.toISOString()
      }
      const wrapper = mount(UniversalCard, {
        props: {
          product: product,
          mode: 'selection'
        }
      })

      const timeElement = wrapper.find('.create-time')
      expect(timeElement.text()).toBe('3天前')
    })
  })
})
