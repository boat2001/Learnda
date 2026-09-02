// models/AcademicProfile.js
//
// A learner's place in the Ghanaian school timeline. See learnda-dev-guide.md §6.2.
//
// This is the single row that decides what a learner may see: every content
// query scopes against `class_level` (§5). It is deliberately NOT user-editable
// -- §1.4 and §6.4 require that a learner cannot change their own class level.
// Promotion happens when the academic year turns, through the promotion service,
// and manual overrides are restricted to admin/parent accounts and logged (§6.5).
const { DataTypes } = require('sequelize');
const {
  LEVEL_GROUP_VALUES,
  CLASS_LEVEL_CODES,
  ACADEMIC_TERMS,
  ACADEMIC_PROFILE_STATUSES,
  getLevelGroup,
  getAcademicYearLabel,
  isValidAcademicYear,
} = require('../config/educationStructure');

module.exports = (sequelize) => {
  const AcademicProfile = sequelize.define('AcademicProfile', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true
    },
    level_group: {
      type: DataTypes.ENUM(...LEVEL_GROUP_VALUES),
      allowNull: false
    },
    // The learner's current class. The only field content access compares against.
    class_level: {
      type: DataTypes.ENUM(...CLASS_LEVEL_CODES),
      allowNull: false
    },
    academic_year: {
      type: DataTypes.STRING(9),
      allowNull: false,
      defaultValue: () => getAcademicYearLabel(),
      validate: {
        isAcademicYear(value) {
          if (!isValidAcademicYear(value)) {
            throw new Error(`academic_year must look like "2025/2026", got "${value}"`);
          }
        }
      }
    },
    term: {
      type: DataTypes.ENUM(...ACADEMIC_TERMS),
      allowNull: false,
      defaultValue: ACADEMIC_TERMS[0]
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ACADEMIC_PROFILE_STATUSES)),
      allowNull: false,
      defaultValue: ACADEMIC_PROFILE_STATUSES.ACTIVE
    },
    // When true the learner is promoted automatically as the academic year turns.
    auto_progression: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    // SHS only (§4.4): which pathway the learner is offering. Null below SHS.
    pathway_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    // Set only for learners at a school designated to offer the STEM pathway (§4.4.9).
    is_stem_school: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    // Reserved for the parent/guardian link (§4.1 parent-guided KG, §6.5 overrides).
    // Populated when guardian accounts ship; null until then.
    guardian_user_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    // Last time the learner moved class, for auditing promotion (§6.5).
    promoted_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    tableName: 'academic_profiles',
    timestamps: true,
    underscored: true,
    indexes: [
      { name: 'academic_profiles_user_id_uidx', unique: true, fields: ['user_id'] },
      { name: 'academic_profiles_class_level_idx', fields: ['level_group', 'class_level'] },
      { name: 'academic_profiles_academic_year_idx', fields: ['academic_year', 'status'] },
      { name: 'academic_profiles_pathway_idx', fields: ['pathway_id'] },
      { name: 'academic_profiles_guardian_idx', fields: ['guardian_user_id'] }
    ],
    validate: {
      // level_group is derived data; if it disagrees with class_level the two
      // could drift and a learner would be gated against the wrong group.
      levelGroupMatchesClass() {
        const derived = getLevelGroup(this.class_level);
        if (derived !== this.level_group) {
          throw new Error(
            `AcademicProfile: class_level ${this.class_level} belongs to ${derived}, not ${this.level_group}`
          );
        }
      },
      // §4.4: pathways exist only at SHS.
      pathwayOnlyAtShs() {
        if (this.pathway_id && this.level_group !== 'SHS') {
          throw new Error(`AcademicProfile: pathway_id is only valid for SHS, not ${this.level_group}`);
        }
      }
    },
    hooks: {
      // Keep level_group consistent without making callers pass it.
      beforeValidate: (profile) => {
        const derived = getLevelGroup(profile.class_level);
        if (derived) profile.level_group = derived;
      }
    }
  });

  AcademicProfile.associate = (models) => {
    AcademicProfile.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });

    if (models.LearningPathway) {
      AcademicProfile.belongsTo(models.LearningPathway, {
        foreignKey: 'pathway_id',
        as: 'pathway'
      });
    }
    if (models.User) {
      AcademicProfile.belongsTo(models.User, {
        foreignKey: 'guardian_user_id',
        as: 'guardian',
        constraints: false
      });
    }
  };

  return AcademicProfile;
};
