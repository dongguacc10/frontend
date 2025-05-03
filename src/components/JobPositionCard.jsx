import React from "react";
import { Card, CardBody, CardHeader, Badge } from "@heroui/react";
import { MapPin, Buildings, GraduationCap, Clock, CurrencyCircleDollar } from "@phosphor-icons/react";
import { motion } from "framer-motion";

/**
 * 职位卡片组件
 * @param {Object} position - 职位信息对象
 */
const JobPositionCard = ({ position }) => {
  // 获取职位类型文本
  const getPositionTypeText = (type) => {
    const types = {
      "1": "全职",
      "2": "零工/兼职",
      "3": "实习",
      "4": "急聘"
    };
    return types[type] || "未知";
  };

  // 获取教育程度文本
  const getEducationText = (education) => {
    return position.educationStr || "学历不限";
  };

  // 获取薪资文本
  const getSalaryText = () => {
    if (position.partTimeSalary && position.partTimeSalaryTypeText) {
      return `${position.partTimeSalary}${position.partTimeSalaryTypeText}`;
    } else if (position.salaryText) {
      return position.salaryText;
    } else if (position.minSalary && position.maxSalary) {
      return `${position.minSalary}-${position.maxSalary}元/月`;
    } else {
      return "薪资面议";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4"
    >
      <Card className="border-0 shadow-sm">
        <CardHeader className="d-flex justify-content-between align-items-center bg-white border-bottom-0 pb-0">
          <div>
            <h5 className="mb-1 text-primary fw-bold">{position.positionName}</h5>
            <div className="d-flex align-items-center text-muted mb-2">
              <Buildings size={16} className="me-1" />
              <span className="me-3">{position.companyName || position.ceName}</span>
              <MapPin size={16} className="me-1" />
              <span>{position.workPlaceStr || position.localhostText}</span>
            </div>
          </div>
          <div className="text-end">
            <h5 className="text-danger mb-0">{getSalaryText()}</h5>
          </div>
        </CardHeader>
        <CardBody className="pt-2">
          <div className="d-flex flex-wrap mb-2">
            <Badge color="primary" className="me-2 mb-2">
              {getPositionTypeText(position.positionType)}
            </Badge>
            {position.jobTypeText && (
              <Badge color="secondary" className="me-2 mb-2">
                {position.jobTypeText}
              </Badge>
            )}
            <Badge color="info" className="me-2 mb-2">
              <GraduationCap size={14} className="me-1" />
              {getEducationText(position.education)}
            </Badge>
            {position.isUrgent === 1 && (
              <Badge color="danger" className="me-2 mb-2">
                急聘
              </Badge>
            )}
          </div>
          <div className="d-flex justify-content-between align-items-center mt-3">
            <div className="text-muted small">
              <Clock size={14} className="me-1" />
              {new Date(position.lastSendTime).toLocaleDateString()}发布
            </div>
            <button className="btn btn-sm btn-outline-primary">
              申请职位
            </button>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  );
};

export default JobPositionCard;
