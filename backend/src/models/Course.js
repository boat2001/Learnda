// models/Course.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Course = sequelize.define('Course', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    key: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    credits: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    department: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'courses',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['key'], unique: true },
      { fields: ['department'] }
    ]
  });

  Course.associate = () => {
  };

  return Course;
};
