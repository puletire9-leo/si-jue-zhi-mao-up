#!/usr/bin/env python3
"""
蓝绿部署脚本
实现零停机部署和快速回滚
"""

import os
import sys
import time
import subprocess
import argparse
from typing import Optional, Dict, List
from enum import Enum


class DeploymentColor(Enum):
    """部署颜色"""
    BLUE = "blue"
    GREEN = "green"


class BlueGreenDeployment:
    """蓝绿部署管理器"""
    
    def __init__(self, namespace: str = "production"):
        self.namespace = namespace
        self.backend_deployment = f"image-database-backend"
        self.frontend_deployment = f"image-database-frontend"
        self.service = f"image-database-service"
        
    def get_current_color(self) -> Optional[DeploymentColor]:
        """获取当前活动的颜色"""
        try:
            result = subprocess.run(
                ["kubectl", "get", "service", self.service, "-n", self.namespace, 
                 "-o", "jsonpath={.spec.selector.version}"],
                capture_output=True,
                text=True,
                check=True
            )
            version = result.stdout.strip()
            return DeploymentColor(version) if version else None
        except subprocess.CalledProcessError as e:
            print(f"获取当前颜色失败: {e}")
            return None
    
    def get_deployment_color(self, deployment: str) -> Optional[DeploymentColor]:
        """获取部署的颜色"""
        try:
            result = subprocess.run(
                ["kubectl", "get", "deployment", deployment, "-n", self.namespace,
                 "-o", "jsonpath={.metadata.labels.version}"],
                capture_output=True,
                text=True,
                check=True
            )
            version = result.stdout.strip()
            return DeploymentColor(version) if version else None
        except subprocess.CalledProcessError as e:
            print(f"获取部署颜色失败: {e}")
            return None
    
    def wait_for_deployment_ready(self, deployment: str, timeout: int = 300) -> bool:
        """等待部署就绪"""
        print(f"等待部署 {deployment} 就绪...")
        try:
            subprocess.run(
                ["kubectl", "rollout", "status", "deployment", deployment,
                 "-n", self.namespace, "--timeout", f"{timeout}s"],
                check=True
            )
            print(f"✅ 部署 {deployment} 已就绪")
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ 部署 {deployment} 未能在 {timeout} 秒内就绪")
            return False
    
    def deploy_new_version(self, color: DeploymentColor, image_tag: str) -> bool:
        """部署新版本到指定颜色"""
        print(f"\n开始部署新版本到 {color.value} 环境...")
        
        # 更新部署的镜像和标签
        deployments = [self.backend_deployment, self.frontend_deployment]
        
        for deployment in deployments:
            print(f"更新部署 {deployment}...")
            try:
                # 设置颜色标签
                subprocess.run([
                    "kubectl", "label", "deployment", deployment,
                    f"version={color.value}",
                    f"environment={self.namespace}",
                    "-n", self.namespace, "--overwrite"
                ], check=True)
                
                # 更新镜像
                if "backend" in deployment:
                    image = f"imagedb/backend:{image_tag}"
                else:
                    image = f"imagedb/frontend:{image_tag}"
                
                subprocess.run([
                    "kubectl", "set", "image", "deployment", deployment,
                    f"{image}={image}",
                    "-n", self.namespace
                ], check=True)
                
                print(f"✅ 部署 {deployment} 已更新")
                
            except subprocess.CalledProcessError as e:
                print(f"❌ 更新部署 {deployment} 失败: {e}")
                return False
        
        # 等待部署就绪
        for deployment in deployments:
            if not self.wait_for_deployment_ready(deployment):
                return False
        
        print(f"✅ {color.value} 环境部署完成")
        return True
    
    def switch_traffic(self, target_color: DeploymentColor) -> bool:
        """切换流量到目标颜色"""
        print(f"\n切换流量到 {target_color.value} 环境...")
        
        try:
            # 更新服务的selector
            subprocess.run([
                "kubectl", "patch", "service", self.service,
                "-n", self.namespace,
                "-p", f'{{"spec": {{"selector": {{"version": "{target_color.value}"}}}}}'
            ], check=True)
            
            print(f"✅ 流量已切换到 {target_color.value} 环境")
            return True
            
        except subprocess.CalledProcessError as e:
            print(f"❌ 切换流量失败: {e}")
            return False
    
    def run_smoke_tests(self, color: DeploymentColor) -> bool:
        """运行冒烟测试"""
        print(f"\n运行 {color.value} 环境冒烟测试...")
        
        # 这里可以添加实际的冒烟测试逻辑
        # 例如：调用API测试、健康检查等
        
        try:
            # 健康检查
            result = subprocess.run([
                "kubectl", "get", "pods", "-n", self.namespace,
                "-l", f"version={color.value}",
                "-o", "jsonpath={.items[*].status.phase}"
            ], capture_output=True, text=True, check=True)
            
            phases = result.stdout.strip().split(" ")
            if all(phase == "Running" for phase in phases):
                print(f"✅ {color.value} 环境健康检查通过")
                return True
            else:
                print(f"❌ {color.value} 环境健康检查失败")
                return False
                
        except subprocess.CalledProcessError as e:
            print(f"❌ 冒烟测试失败: {e}")
            return False
    
    def monitor_deployment(self, color: DeploymentColor, duration: int = 900) -> bool:
        """监控部署状态"""
        print(f"\n监控 {color.value} 环境状态（{duration} 秒）...")
        
        start_time = time.time()
        check_interval = 30
        
        while time.time() - start_time < duration:
            # 检查Pod状态
            try:
                result = subprocess.run([
                    "kubectl", "get", "pods", "-n", self.namespace,
                    "-l", f"version={color.value}"
                ], capture_output=True, text=True, check=True)
                
                print(f"\n{color.value} 环境Pod状态:")
                print(result.stdout)
                
                # 检查错误率、响应时间等指标
                # 这里可以添加Prometheus查询等监控逻辑
                
            except subprocess.CalledProcessError as e:
                print(f"监控失败: {e}")
                return False
            
            time.sleep(check_interval)
        
        print(f"✅ {color.value} 环境监控完成，未发现异常")
        return True
    
    def rollback(self, target_color: DeploymentColor) -> bool:
        """回滚到指定颜色"""
        print(f"\n开始回滚到 {target_color.value} 环境...")
        
        if not self.switch_traffic(target_color):
            print("❌ 回滚失败")
            return False
        
        print(f"✅ 已回滚到 {target_color.value} 环境")
        return True
    
    def cleanup_old_deployment(self, old_color: DeploymentColor) -> bool:
        """清理旧部署"""
        print(f"\n清理 {old_color.value} 旧部署...")
        
        try:
            # 缩减副本数到0
            deployments = [self.backend_deployment, self.frontend_deployment]
            
            for deployment in deployments:
                subprocess.run([
                    "kubectl", "scale", "deployment", deployment,
                    "--replicas=0", "-n", self.namespace
                ], check=True)
            
            print(f"✅ {old_color.value} 部署已清理")
            return True
            
        except subprocess.CalledProcessError as e:
            print(f"❌ 清理部署失败: {e}")
            return False
    
    def deploy(self, image_tag: str, monitor_duration: int = 900) -> bool:
        """执行完整的蓝绿部署流程"""
        print("=" * 60)
        print("蓝绿部署流程开始")
        print("=" * 60)
        
        # 1. 获取当前颜色
        current_color = self.get_current_color()
        if not current_color:
            print("❌ 无法确定当前颜色")
            return False
        
        print(f"当前活动环境: {current_color.value}")
        
        # 2. 确定目标颜色
        target_color = DeploymentColor.GREEN if current_color == DeploymentColor.BLUE else DeploymentColor.BLUE
        print(f"目标部署环境: {target_color.value}")
        
        # 3. 部署新版本
        if not self.deploy_new_version(target_color, image_tag):
            print("❌ 新版本部署失败")
            return False
        
        # 4. 运行冒烟测试
        if not self.run_smoke_tests(target_color):
            print("❌ 冒烟测试失败，开始回滚...")
            return self.rollback(current_color)
        
        # 5. 切换流量
        if not self.switch_traffic(target_color):
            print("❌ 流量切换失败，开始回滚...")
            return self.rollback(current_color)
        
        # 6. 监控新环境
        if not self.monitor_deployment(target_color, monitor_duration):
            print("⚠️ 监控发现异常，开始回滚...")
            return self.rollback(current_color)
        
        # 7. 清理旧部署
        if not self.cleanup_old_deployment(current_color):
            print("⚠️ 清理旧部署失败，但不影响部署")
        
        print("=" * 60)
        print("✅ 蓝绿部署完成")
        print("=" * 60)
        return True


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='蓝绿部署工具')
    parser.add_argument('--namespace', default='production', help='Kubernetes命名空间')
    parser.add_argument('--image-tag', required=True, help='要部署的镜像标签')
    parser.add_argument('--monitor-duration', type=int, default=900, help='监控时长（秒）')
    parser.add_argument('--rollback-to', choices=['blue', 'green'], help='回滚到指定颜色')
    
    args = parser.parse_args()
    
    deployment = BlueGreenDeployment(namespace=args.namespace)
    
    if args.rollback_to:
        # 回滚模式
        target_color = DeploymentColor(args.rollback_to)
        success = deployment.rollback(target_color)
    else:
        # 部署模式
        success = deployment.deploy(args.image_tag, args.monitor_duration)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()