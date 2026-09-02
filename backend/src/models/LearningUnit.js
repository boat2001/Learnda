// models/LearningUnit.js
//
// A LearningUnit is one teachable thing at a level group: a KG Learning Area
// or a Primary/JHS/SHS Subject. See learnda-dev-guide.md §4.4 developer model.
//
// A unit declares the class-level band it may be taught in (from_class..to_class).
// It does NOT carry content -- Topics, Lessons and PracticeSets hang off a unit
// and each pins its own class_level_code, which is what §5 class-scoping filters on.
const { DataTypes } = require('sequelize');
const {
  LEVEL_GROUP_VALUES,
  LEARNING_TYPES,
  CLASS_LEVEL_CODES,
  LEARNING_UNIT_CATEGORIES,
  getOrdinal,
  getLevelGroup,
} = require('../config/educationStructure');

module.exports = (sequelize) => {
  const LearningUnit = sequelize.define('LearningUnit', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    slug: {
      type: DataTypes.STRING(120),
      allowNull: false,
      validate: {
        is: {
          args: /^[a-z0-9]+(_[a-z0-9]+)*$/,
          msg: 'slug must be lower_snake_case, e.g. "social_studies"'
        }
      }
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    learning_type: {
      type: DataTypes.ENUM(...Object.values(LEARNING_TYPES)),
      allowNull: false
    },
    level_group: {
      type: DataTypes.ENUM(...LEVEL_GROUP_VALUES),
      allowNull: false
    },
    // Inclusive class-level band this unit is taught in, e.g. B1..B6 or JHS1..JHS3.
    from_class: {
      type: DataTypes.ENUM(...CLASS_LEVEL_CODES),
      allowNull: false
    },
    to_class: {
      type: DataTypes.ENUM(...CLASS_LEVEL_CODES),
      allowNull: false
    },
    category: {
      type: DataTypes.ENUM(...Object.values(LEARNING_UNIT_CATEGORIES)),
      allowNull: false,
      defaultValue: LEARNING_UNIT_CATEGORIES.CORE
    },
    // Display order within a level group; lower sorts first.
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    icon: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    color: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    tableName: 'learning_units',
    underscored: true,
    timestamps: true,
    indexes: [
      // A slug is unique per level group, not globally: "english" is a distinct
      // unit in PRIMARY, JHS and SHS, and "rme" exists in all four groups.
      { name: 'learning_units_slug_level_group_uidx', unique: true, fields: ['slug', 'level_group'] },
      { name: 'learning_units_level_group_idx', fields: ['level_group', 'is_active'] },
      { name: 'learning_units_class_band_idx', fields: ['from_class', 'to_class'] },
      { name: 'learning_units_category_idx', fields: ['category'] }
    ],
    validate: {
      // Guards §1.5 / §5: a unit must not claim a band running backwards, and
      // its band must sit inside its own level group. Without this a JHS unit
      // could be given from_class B1 and leak below JHS.
      classBandIsOrdered() {
        const from = getOrdinal(this.from_class);
        const to = getOrdinal(this.to_class);
        if (from === null || to === null) {
          throw new Error(`LearningUnit "${this.slug}": from_class/to_class must be valid class levels`);
        }
        if (from > to) {
          throw new Error(
            `LearningUnit "${this.slug}": from_class (${this.from_class}) is above to_class (${this.to_class})`
          );
        }
      },
      classBandMatchesLevelGroup() {
        const fromGroup = getLevelGroup(this.from_class);
        const toGroup = getLevelGroup(this.to_class);
        if (fromGroup !== this.level_group || toGroup !== this.level_group) {
          throw new Error(
            `LearningUnit "${this.slug}": class band ${this.from_class}..${this.to_class} ` +
            `falls outside its level group ${this.level_group}`
          );
        }
      },
      learningTypeMatchesLevelGroup() {
        const expected = this.level_group === 'KINDERGARTEN'
          ? LEARNING_TYPES.LEARNING_AREA
          : LEARNING_TYPES.SUBJECT;
        if (this.learning_type !== expected) {
          throw new Error(
            `LearningUnit "${this.slug}": ${this.level_group} must use ${expected}, got ${this.learning_type}`
          );
        }
      }
    }
  });

  /** True when this unit is taught at the given class level. */
  LearningUnit.prototype.isTaughtAt = function isTaughtAt(classLevelCode) {
    const target = getOrdinal(classLevelCode);
    if (target === null) return false;
    return target >= getOrdinal(this.from_class) && target <= getOrdinal(this.to_class);
  };

  LearningUnit.associate = (models) => {
    if (models.PathwaySubjectRule) {
      LearningUnit.hasMany(models.PathwaySubjectRule, {
        foreignKey: 'learning_unit_id',
        as: 'pathway_rules'
      });
    }
  };

  return LearningUnit;
};
