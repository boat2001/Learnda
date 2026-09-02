// models/LeaderboardEntry.js (minimal stub)
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LeaderboardEntry = sequelize.define('LeaderboardEntry', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    leaderboard_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    score: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    rank: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'leaderboard_entries',
    underscored: true,
    timestamps: true
  });

  LeaderboardEntry.associate = (models) => {
    LeaderboardEntry.belongsTo(models.Leaderboard, { foreignKey: 'leaderboard_id', as: 'leaderboard' });
    LeaderboardEntry.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return LeaderboardEntry;
};
