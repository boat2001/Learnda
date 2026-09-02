// models/PastQuestionMode.js (minimal stub)
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PastQuestionMode = sequelize.define('PastQuestionMode', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    content_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    mode: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'past_question_modes',
    underscored: true,
    timestamps: true
  });

  PastQuestionMode.associate = () => {
    // content_id is a soft reference — no FK constraint
  };

  return PastQuestionMode;
};
