// models/Progress.js (UserProgress)
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserProgress = sequelize.define('UserProgress', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    xp: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    level: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    streak: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    last_activity_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    total_lessons_completed: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    total_quizzes_completed: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    total_contributions: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    tableName: 'user_progress',
    underscored: true,
    timestamps: true
  });

  UserProgress.associate = (models) => {
    UserProgress.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return UserProgress;
};
