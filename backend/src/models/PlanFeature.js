// models/PlanFeature.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PlanFeature = sequelize.define('PlanFeature', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    plan_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    feature_key: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    config: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'plan_features',
    underscored: true,
    timestamps: true
  });

  PlanFeature.associate = (models) => {
    PlanFeature.belongsTo(models.Plan, { foreignKey: 'plan_id', as: 'plan' });
  };

  return PlanFeature;
};
