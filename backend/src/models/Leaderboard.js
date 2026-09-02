// models/Leaderboard.js (minimal stub)
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Leaderboard = sequelize.define('Leaderboard', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    reset_period: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'leaderboards',
    underscored: true,
    timestamps: true
  });

  Leaderboard.associate = (models) => {
    Leaderboard.hasMany(models.LeaderboardEntry, { foreignKey: 'leaderboard_id', as: 'entries' });
  };

  return Leaderboard;
};
