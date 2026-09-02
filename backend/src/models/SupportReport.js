const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SupportReport = sequelize.define('SupportReport', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('new', 'in_progress', 'resolved'),
      defaultValue: 'new'
    },
    admin_reply: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    replied_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    replied_by: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    tableName: 'support_reports',
    timestamps: true,
    underscored: true
  });

  SupportReport.associate = (models) => {
    SupportReport.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return SupportReport;
};
