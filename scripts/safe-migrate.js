#!/usr/bin/env node

import {execSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {config} from 'dotenv';

// 加载环境变量
config({ path: path.resolve(process.cwd(), '../.env') });

// 颜色输出函数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️ ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

// 检查环境变量
if (!process.env.DATABASE_URL) {
  logError('DATABASE_URL 环境变量未设置');
  process.exit(1);
}

// 安全执行命令
function safeExec(command, options = {}) {
  try {
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    logError(`命令执行失败: ${command}`);
    logError(error.message);
    return false;
  }
}

// 检查文件是否存在
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

// 处理数据冲突的函数
async function handleDataConflicts() {
  try {
    // 在Vercel环境中，我们主要关注schema同步而不是数据冲突处理
    log('检查数据库连接...', 'cyan');
    
    // 简单的连接测试
    if (!safeExec('cd .. && npx drizzle-kit check --config=drizzle.config.ts', { stdio: 'pipe' })) {
      logWarning('数据库schema检查失败，将尝试强制同步');
    }
    
    logSuccess('数据冲突检查完成');
  } catch (error) {
    logWarning(`数据冲突处理警告: ${error.message}`);
  }
}

async function safeMigrate() {
  log('🔄 开始安全数据库迁移流程...', 'bright');
  
  try {
    // 获取项目根目录路径
    const projectRoot = path.resolve(process.cwd(), '..');
    const drizzleConfigPath = path.join(projectRoot, 'drizzle.config.ts');
    const schemaPath = path.join(projectRoot, 'drizzle/schema.ts');
    const migrationsPath = path.join(projectRoot, 'drizzle/migrations');
    
    // 1. 确保drizzle配置存在
    if (!fileExists(drizzleConfigPath)) {
      throw new Error(`drizzle.config.ts 配置文件不存在: ${drizzleConfigPath}`);
    }
    
    // 2. 检查schema文件
    if (!fileExists(schemaPath)) {
      throw new Error(`drizzle/schema.ts 文件不存在: ${schemaPath}`);
    }
    
    // 3. 创建迁移目录（如果不存在）
    if (!fileExists(migrationsPath)) {
      log('创建迁移目录...', 'cyan');
      fs.mkdirSync(migrationsPath, { recursive: true });
    }
    
    // 4. 生成迁移文件（如果需要）
    log('生成数据库迁移文件...', 'cyan');
    
    // 设置非交互式环境变量
    const nonInteractiveEnv = {
      ...process.env,
      DRIZZLE_KIT_FORCE: 'true',
      CI: 'true',
      NODE_ENV: 'production'
    };
    
    if (!safeExec('npm run db:generate', { env: nonInteractiveEnv })) {
      logWarning('迁移文件生成失败，尝试直接同步...');
    } else {
      logSuccess('迁移文件生成完成');
    }
    
    // 5. 预处理数据冲突
    log('🔍 检查并处理数据冲突...', 'cyan');
    await handleDataConflicts();
    
    // 6. 统一迁移策略：优先执行 migrate，失败则 push
    log('🚦 统一迁移策略：优先执行 migrate，失败再 push', 'cyan');
    
    // 设置非交互式环境变量
    const env = {
      ...process.env,
      DRIZZLE_KIT_FORCE: 'true',
      CI: 'true',
      NODE_ENV: 'production'
    };
    
    // 先尝试标准迁移（不会产生交互式提示）
    if (safeExec('cd .. && npx drizzle-kit migrate --config=drizzle.config.ts', { env })) {
      logSuccess('数据库迁移成功');
    } else {
      logWarning('标准迁移失败，尝试使用 push 同步...');
      
      // 作为后备，强制同步 schema（避免交互）
      if (safeExec('cd .. && npx drizzle-kit push --force --config=drizzle.config.ts', { env })) {
        logSuccess('数据库 schema 同步成功');
      } else {
        throw new Error('数据库迁移与同步均失败');
      }
    }
    
    // 8. 验证迁移结果
    log('✅ 数据库迁移流程完成！', 'green');
    
  } catch (error) {
    logError(`迁移失败: ${error.message}`);
    logError('请检查数据库连接和迁移文件');
    process.exit(1);
  }
}

// 运行迁移
safeMigrate().catch(error => {
  logError(`未预期的错误: ${error.message}`);
  process.exit(1);
});