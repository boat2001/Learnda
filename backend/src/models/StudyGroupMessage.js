const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StudyGroupMessage = sequelize.define('StudyGroupMessage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    group_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    tableName: 'study_group_messages',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['group_id', 'created_at'] },
      { fields: ['user_id', 'created_at'] }
    ]
  });

  StudyGroupMessage.associate = (models) => {
    StudyGroupMessage.belongsTo(models.StudyGroup, {
      foreignKey: 'group_id',
      as: 'group'
    });
    StudyGroupMessage.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'author'
    });
  };

  return StudyGroupMessage;
};
