const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AdminAuditLog = sequelize.define('AdminAuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    admin_user_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    admin_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    admin_email: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    action: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    section: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    method: {
      type: DataTypes.STRING(12),
      allowNull: true
    },
    path: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    status_code: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    target_type: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    target_id: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    ip_address: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    tableName: 'admin_audit_logs',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['admin_user_id'] },
      { fields: ['section'] },
      { fields: ['action'] },
      { fields: ['created_at'] }
    ]
  });

  AdminAuditLog.associate = (models) => {
    if (models.User) {
      AdminAuditLog.belongsTo(models.User, {
        foreignKey: 'admin_user_id',
        as: 'admin'
      });
    }
  };

  return AdminAuditLog;
};
