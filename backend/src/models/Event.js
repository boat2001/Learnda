// models/Event.js (minimal stub)
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Event = sequelize.define('Event', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    visitor_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    session_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    event_type: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    event_data: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    page_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    referrer_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    user_agent: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    ip_address: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    device_type: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  }, {
    tableName: 'events',
    underscored: true,
    timestamps: true
  });

  return Event;
};
