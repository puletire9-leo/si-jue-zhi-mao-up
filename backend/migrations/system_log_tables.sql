-- 创建系统文档表
CREATE TABLE IF NOT EXISTS system_docs (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 创建更新记录表
CREATE TABLE IF NOT EXISTS update_records (
    id VARCHAR(36) PRIMARY KEY,
    date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    implementation TEXT NOT NULL,
    updateType ENUM('success', 'info', 'warning', 'error') NOT NULL,
    icon VARCHAR(100),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建需求清单表
CREATE TABLE IF NOT EXISTS requirements (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority ENUM('high', 'medium', 'low') NOT NULL,
    status ENUM('pending', 'in_progress', 'completed') NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 插入初始系统文档数据
INSERT INTO system_docs (id, title, content, category) VALUES
('1', '认证系统', '提供用户登录、注册、权限管理等功能。使用 JWT 进行身份验证，RBAC 模型进行权限管理。', '系统架构'),
('2', '产品管理', '提供产品的增删改查、分类管理等功能。使用 RESTful API 进行产品管理，支持分页和搜索。', '核心功能'),
('3', '图片处理', '提供图片上传、下载、处理等功能。使用腾讯云 COS 进行图片存储，支持图片压缩和格式转换。', '核心功能'),
('4', '备份功能', '提供数据库备份、恢复等功能。支持本地备份和腾讯云 COS 备份，自动备份和手动备份。', '系统维护');

-- 插入初始更新记录数据
INSERT INTO update_records (id, date, title, content, implementation, updateType, icon) VALUES
('1', '2024-01-30', '添加系统日志功能', '在系统设置中添加系统日志功能，包含系统文档、更新记录、需求清单三个模块。', '使用 Vue 3 + Element Plus 实现前端界面，添加相关 API 接口。', 'success', 'el-icon-success'),
('2', '2024-01-29', '优化备份功能', '优化备份功能，支持本地备份和腾讯云备份。', '使用 Python 实现备份逻辑，集成腾讯云 COS SDK。', 'info', 'el-icon-info'),
('3', '2024-01-28', '修复图片上传问题', '修复图片上传失败的问题。', '优化图片上传逻辑，添加错误处理。', 'warning', 'el-icon-warning');

-- 插入初始需求清单数据
INSERT INTO requirements (id, name, description, priority, status) VALUES
('1', '添加用户头像上传功能', '允许用户上传和修改个人头像。', 'high', 'pending'),
('2', '实现数据导出功能', '支持将产品数据导出为 Excel 格式。', 'medium', 'in_progress'),
('3', '优化搜索功能', '提高搜索速度和准确性。', 'low', 'pending');
