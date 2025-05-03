import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import JobPositionCard from "./JobPositionCard";
import api from "../services/api";

/**
 * 职位列表组件
 * @param {Object} searchResult - 职位搜索结果
 */
const JobPositionList = ({ searchResult = {} }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [positions, setPositions] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // 当searchResult变化时，重置状态
  useEffect(() => {
    if (searchResult && searchResult.data && searchResult.data.list) {
      setPositions(searchResult.data.list);
      setCurrentPage(0);
      setHasMore(searchResult.data.list.length < searchResult.data.count);
    }
  }, [searchResult]);

  if (!searchResult.data || !searchResult.data.list || searchResult.data.list.length === 0) {
    return (
      <div className="text-center p-4">
        <p className="text-muted">暂无匹配的职位信息</p>
      </div>
    );
  }

  const { list, count } = searchResult.data;
  const viewMoreLink = searchResult.view_more_link || null;
  const totalLoaded = positions.length;

  // 处理"查看更多"按钮点击
  const handleViewMore = async () => {
    if (!viewMoreLink) {
      console.error("缺少API信息");
      return;
    }

    try {
      setIsLoading(true);
      
      // 准备请求参数，更新页码
      const params = { ...viewMoreLink.params };
      params.pageNo = currentPage + 1;
      
      // 使用api.getMorePositions方法获取更多职位
      const data = await api.getMorePositions(params);
      
      if (data && data.code === "200" && data.data && data.data.list) {
        // 获取新加载的职位数据
        const newPositions = data.data.list;
        
        // 合并现有职位和新加载的职位
        const updatedPositions = [...positions, ...newPositions];
        setPositions(updatedPositions);
        
        // 更新当前页码
        setCurrentPage(currentPage + 1);
        
        // 判断是否还有更多数据
        setHasMore(updatedPositions.length < data.data.count);
      } else {
        console.error("获取更多职位失败:", data);
        setHasMore(false);
      }
    } catch (error) {
      console.error("调用职位搜索API出错:", error);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="job-position-list"
    >
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">{searchResult.search_summary || `搜索到 ${count} 个职位`}</h5>
      </div>
      
      {/* 显示所有已加载的职位列表 */}
      {positions.map((position) => (
        <JobPositionCard key={position.id} position={position} />
      ))}
      
      {/* 查看更多按钮 - 只要还有更多数据就显示 */}
      {hasMore && count > totalLoaded && (
        <div className="text-center mt-3">
          <button 
            className="btn btn-outline-primary"
            onClick={handleViewMore}
            disabled={isLoading}
          >
            {isLoading ? (
              <span>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                加载中...
              </span>
            ) : (
              `查看更多职位 (已加载 ${totalLoaded}/${count})`
            )}
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default JobPositionList;
