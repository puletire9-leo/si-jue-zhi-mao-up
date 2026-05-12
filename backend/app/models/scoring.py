from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class ThresholdItem(BaseModel):
    """阈值项"""
    min: Optional[float] = Field(None, description="最小值（包含）")
    max: Optional[float] = Field(None, description="最大值（不包含）")
    score: int = Field(..., description="对应分数")


class ScoringConfigItem(BaseModel):
    """评分维度配置项"""
    id: Optional[int] = Field(None, description="配置ID")
    dimension_key: str = Field(..., description="维度标识", alias="dimensionKey")
    display_name: str = Field(..., description="显示名称", alias="displayName")
    weight: float = Field(..., description="权重百分比")
    thresholds: List[ThresholdItem] = Field(..., description="阈值配置")
    is_active: bool = Field(True, description="是否启用", alias="isActive")
    updated_at: Optional[datetime] = Field(None, description="更新时间", alias="updatedAt")

    class Config:
        populate_by_name = True


class GradeThresholdItem(BaseModel):
    """等级阈值配置项"""
    id: Optional[int] = Field(None, description="配置ID")
    grade: str = Field(..., description="等级（S/A/B/C/D）")
    min_score: int = Field(..., description="最低分", alias="minScore")
    max_score: int = Field(..., description="最高分", alias="maxScore")
    color: Optional[str] = Field(None, description="显示颜色")
    updated_at: Optional[datetime] = Field(None, description="更新时间", alias="updatedAt")

    class Config:
        populate_by_name = True


class ScoringConfigResponse(BaseModel):
    """评分配置响应"""
    dimensions: List[ScoringConfigItem] = Field(..., description="维度配置列表")
    grade_thresholds: List[GradeThresholdItem] = Field(..., description="等级阈值列表", alias="gradeThresholds")

    class Config:
        populate_by_name = True


class ScoringConfigUpdateRequest(BaseModel):
    """更新评分配置请求"""
    dimensions: Optional[List[ScoringConfigItem]] = Field(None, description="维度配置列表")
    grade_thresholds: Optional[List[GradeThresholdItem]] = Field(None, description="等级阈值列表", alias="gradeThresholds")

    class Config:
        populate_by_name = True


class RecalculateRequest(BaseModel):
    """重新评分请求"""
    scope: str = Field("all", description="评分范围: all=全部, current_week=本周", pattern="^(all|current_week)$")


class GradeStatsItem(BaseModel):
    """等级统计项"""
    grade: str = Field(..., description="等级")
    count: int = Field(..., description="数量")
    color: Optional[str] = Field(None, description="显示颜色")


class ScoreResult(BaseModel):
    """单个商品评分结果"""
    score: int = Field(..., description="评分")
    grade: str = Field(..., description="等级")


class RecalculateResponse(BaseModel):
    """重新评分响应"""
    total_scored: int = Field(..., description="评分总数", alias="totalScored")
    grade_stats: List[GradeStatsItem] = Field(..., description="各等级统计", alias="gradeStats")

    class Config:
        populate_by_name = True
