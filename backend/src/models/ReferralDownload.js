// models/ReferralDownload.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ReferralDownload = sequelize.define('ReferralDownload', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    referrer_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    referral_code: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    visitor_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    ip_address: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    user_agent: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    source: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  }, {
    tableName: 'referral_downloads',
    underscored: true,
    timestamps: true
  });

  ReferralDownload.associate = (models) => {
    if (models.User) {
      ReferralDownload.belongsTo(models.User, {
        foreignKey: 'referrer_id',
        as: 'referrer'
      });
    }
  };

  return ReferralDownload;
};
