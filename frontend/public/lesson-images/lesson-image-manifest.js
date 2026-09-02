/**
 * Lesson Image Manifest
 * Maps illustrations, diagrams, and photos to each lesson chunk paragraph.
 *
 * Each illustration entry:
 *   image_url   – path or full URL to the image
 *   alt         – descriptive alt text for accessibility
 *   caption     – displayed beneath the image in the lesson viewer
 *   credit      – source attribution
 *   placement   – "before" | "after" (relative to paragraph text)
 *   type        – "diagram" | "photo" | "infographic" | "illustration"
 *
 * Local SVG diagrams live at: /lesson-images/*.svg  (frontend/public/lesson-images/)
 * External photos are free-to-use (Unsplash CC0, Wikimedia Commons CC/PD).
 *
 * Generated: 2026-06-09
 */

export const lessonImageManifest = {

  // ==================== LESSON 1 ====================
  // Main Topic: The Concept of Growth and Development
  // ====================================================

  lesson_1: {
    chunk_0: {
      // Chunk: "The Meaning of Growth"
      par_0: {
        illustration: {
          image_url: "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=800&auto=format&fit=crop",
          alt: "A doctor measuring a child's height on a growth chart, illustrating physical growth",
          caption: "Growth is measurable – doctors track height and weight over time using growth charts.",
          credit: "Photo: Unsplash (free to use)",
          placement: "after",
          type: "photo",
        },
      },
      par_1: {
        illustration: {
          image_url: "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=800&auto=format&fit=crop",
          alt: "A tall child standing next to a shorter child, showing physical growth differences",
          caption: "\"Kojo has grown tall\" – growth is observable and can be compared between individuals.",
          credit: "Photo: Unsplash (free to use)",
          placement: "after",
          type: "photo",
        },
      },
    },

    chunk_1: {
      // Chunk: "The Meaning of Development"
      par_0: {
        illustration: {
          image_url: "https://images.unsplash.com/photo-1597764690523-9bda97ec8e3c?w=800&auto=format&fit=crop",
          alt: "A toddler taking first steps while parent watches, showing development from crawling to walking",
          caption: "Development in action: a baby who crawled now walks – a qualitative change in functionality.",
          credit: "Photo: Unsplash (free to use)",
          placement: "after",
          type: "photo",
        },
      },
      par_1: {
        illustration: {
          image_url: "/lesson-images/growth-development-maturation.svg",
          alt: "Comparison diagram showing the key differences between Growth, Development, and Maturation",
          caption: "Growth, Development, and Maturation compared: each term describes a different aspect of change in a child.",
          credit: "Learnda Educational Diagram",
          placement: "after",
          type: "diagram",
        },
      },
    },

    chunk_2: {
      // Chunk: "Differences Between Growth and Development"
      par_0: {
        illustration: {
          image_url: "/lesson-images/growth-development-maturation.svg",
          alt: "Side-by-side comparison table of Growth vs Development vs Maturation",
          caption: "Key differences at a glance: Growth is quantitative and measurable; Development is broader and includes qualitative changes.",
          credit: "Learnda Educational Diagram",
          placement: "before",
          type: "diagram",
        },
      },
    },

    chunk_3: {
      // Chunk: "The Meaning of Maturation"
      par_0: {
        illustration: {
          image_url: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&auto=format&fit=crop",
          alt: "Stages of child growth from infant to teenager, showing physical maturation over time",
          caption: "Maturation is the gradual unfolding of biological potential – it cannot be forced or rushed.",
          credit: "Photo: Unsplash (free to use)",
          placement: "after",
          type: "photo",
        },
      },
      par_1: {
        illustration: {
          image_url: "/lesson-images/maturation-readiness-teachers.svg",
          alt: "Mind map showing maturation, readiness signs, and teacher implications",
          caption: "What teachers need to know: maturation determines readiness. Tasks must align with a child's developmental stage.",
          credit: "Learnda Educational Diagram",
          placement: "after",
          type: "diagram",
        },
      },
    },

    chunk_4: {
      // Chunk: "Key Notes for Teachers"
      par_0: {
        illustration: {
          image_url: "https://images.unsplash.com/photo-1567953733309-84ad1a8a6634?w=800&auto=format&fit=crop",
          alt: "A teacher working patiently with a young student at a desk, demonstrating age-appropriate instruction",
          caption: "Effective teachers observe readiness signals and adjust their teaching to match the child's maturation level.",
          credit: "Photo: Unsplash (free to use)",
          placement: "after",
          type: "photo",
        },
      },
    },
  },


  // ==================== LESSON 2 ====================
  // Main Topic: Physical Development of the Child
  // ====================================================

  lesson_2: {
    chunk_0: {
      // Chunk: "Physical Development"
      par_0: {
        illustration: {
          image_url: "/lesson-images/physical-development-stages.svg",
          alt: "Timeline diagram showing physical development stages: Infancy, Childhood, and Adolescence",
          caption: "Physical development covers changes in height, weight, bones, muscles, teeth, brain, and sense organs across three major stages.",
          credit: "Learnda Educational Diagram",
          placement: "after",
          type: "diagram",
        },
      },
    },

    chunk_1: {
      // Chunk: "Motor Development"
      par_0: {
        illustration: {
          image_url: "/lesson-images/motor-skills-diagram.svg",
          alt: "Diagram comparing gross motor skills (running, jumping, throwing) and fine motor skills (writing, threading, knitting)",
          caption: "Motor development has two branches: Gross Motor Skills (large muscles) and Fine Motor Skills (small muscles like fingers).",
          credit: "Learnda Educational Diagram",
          placement: "after",
          type: "diagram",
        },
      },
      par_1: {
        illustration: {
          image_url: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop",
          alt: "Children running and playing outdoors, demonstrating gross motor skill development",
          caption: "Gross motor skills – children at play use large muscle groups: running, jumping, and throwing.",
          credit: "Photo: Unsplash (free to use)",
          placement: "after",
          type: "photo",
        },
      },
    },

    chunk_2: {
      // Chunk: "Stages in Physical Growth and Changes"
      par_0: {
        illustration: {
          image_url: "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=800&auto=format&fit=crop",
          alt: "A newborn baby being held, showing the small size and helplessness of infancy",
          caption: "At birth, the average infant weighs ~3 kg and measures ~50 cm. Bones are soft cartilage at this stage.",
          credit: "Photo: Unsplash (free to use)",
          placement: "after",
          type: "photo",
        },
      },
      par_1: {
        illustration: {
          image_url: "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=800&auto=format&fit=crop",
          alt: "Baby's motor milestones: sitting, crawling, then standing while holding furniture",
          caption: "Infancy motor milestones progress from sitting to crawling, creeping, walking, and eventually jumping.",
          credit: "Photo: Unsplash (free to use)",
          placement: "after",
          type: "photo",
        },
      },
      par_2: {
        illustration: {
          image_url: "/lesson-images/physical-development-stages.svg",
          alt: "Full physical development stages diagram covering infancy, childhood, and adolescence",
          caption: "Childhood spans ages 2–11, divided into early, middle, and late childhood – each with distinct physical characteristics.",
          credit: "Learnda Educational Diagram",
          placement: "after",
          type: "diagram",
        },
      },
      par_3: null,
      par_4: null,
      par_5: {
        illustration: {
          image_url: "https://images.unsplash.com/photo-1489710437720-ebb67ec84dd2?w=800&auto=format&fit=crop",
          alt: "Primary school-age children playing sports on a field, showing childhood physical development",
          caption: "Middle to late childhood: limbs grow, permanent teeth emerge, and physical coordination becomes smoother.",
          credit: "Photo: Unsplash (free to use)",
          placement: "after",
          type: "photo",
        },
      },
      par_6: null,
      par_7: {
        illustration: {
          image_url: "https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=800&auto=format&fit=crop",
          alt: "Teenagers in a group, showing the physical changes of adolescence",
          caption: "Adolescence (11–18): rapid height growth, voice changes in boys, breast development in girls, and increasing self-awareness.",
          credit: "Photo: Unsplash (free to use)",
          placement: "after",
          type: "photo",
        },
      },
      par_8: null,
      par_9: {
        illustration: {
          image_url: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&auto=format&fit=crop",
          alt: "A teacher in a well-lit classroom guiding students through an activity, showing educational implications",
          caption: "Classroom implication: use large fonts for young children, provide age-appropriate materials, and allow regular physical activity.",
          credit: "Photo: Unsplash (free to use)",
          placement: "after",
          type: "photo",
        },
      },
    },
  },


  // ==================== LESSON 3 ====================
  // Main Topic: Cognitive Development (Jean Piaget)
  // ====================================================

  lesson_3: {
    chunk_0: {
      // Chunk: "Cognitive Development"
      par_0: {
        illustration: {
          // Piaget portrait from Wikimedia Commons (public domain)
          image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Jean_Piaget_in_Ann_Arbor.png/330px-Jean_Piaget_in_Ann_Arbor.png",
          alt: "Portrait photograph of Jean Piaget, Swiss psychologist and pioneer of cognitive development theory",
          caption: "Jean Piaget (1896–1980) — Swiss psychologist who revolutionised our understanding of how children think and learn.",
          credit: "Photo: Wikimedia Commons (Public Domain / CC)",
          placement: "after",
          type: "photo",
        },
      },
      par_1: null,
      par_2: {
        illustration: {
          image_url: "/lesson-images/piaget-four-stages.svg",
          alt: "Overview diagram of Piaget's four stages of cognitive development: Sensorimotor, Pre-Operational, Concrete Operational, Formal Operational",
          caption: "Piaget's four stages of cognitive development — each stage builds on the previous one and cannot be skipped.",
          credit: "Learnda Educational Diagram",
          placement: "after",
          type: "diagram",
        },
      },
    },

    chunk_1: {
      // Chunk: "Stages of Intellectual Development"
      par_0: {
        // Sensorimotor
        illustration: {
          image_url: "/lesson-images/piaget-object-permanence.svg",
          alt: "Diagram showing the object permanence experiment: younger infant doesn't search for hidden toy; older infant lifts the blanket",
          caption: "Object permanence — a key Sensorimotor milestone. Young infants believe a toy hidden under a blanket no longer exists.",
          credit: "Learnda Educational Diagram",
          placement: "after",
          type: "diagram",
        },
      },
      par_1: {
        // Pre-Operational
        illustration: {
          image_url: "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=800&auto=format&fit=crop",
          alt: "A young child playing pretend with toys, demonstrating symbolic play in the pre-operational stage",
          caption: "Pre-Operational Stage (2–7): children engage in symbolic play (make-believe), but are still egocentric.",
          credit: "Photo: Unsplash (free to use)",
          placement: "after",
          type: "photo",
        },
      },
      par_2: {
        // Concrete Operational
        illustration: {
          image_url: "/lesson-images/piaget-conservation-experiment.svg",
          alt: "Step-by-step diagram of Piaget's liquid conservation experiment showing pre-operational vs concrete operational responses",
          caption: "Conservation experiment: concrete operational children (7–11) understand that pouring water into a different container doesn't change the amount.",
          credit: "Learnda Educational Diagram",
          placement: "after",
          type: "diagram",
        },
      },
      par_3: {
        // Formal Operational
        illustration: {
          image_url: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&auto=format&fit=crop",
          alt: "Teenagers engaged in a classroom debate, demonstrating abstract and formal operational thinking",
          caption: "Formal Operational Stage (11+): adolescents can debate, hypothesise, and think about abstract ideas and future possibilities.",
          credit: "Photo: Unsplash (free to use)",
          placement: "after",
          type: "photo",
        },
      },
    },

    chunk_2: {
      // Chunk: "Educational Implications of Piaget's Cognitive Development"
      par_0: {
        illustration: {
          image_url: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&auto=format&fit=crop",
          alt: "A teacher using colourful blocks and concrete objects to teach young children in a classroom",
          caption: "Concrete learning in action: young children learn best through hands-on interaction with real objects, not abstract instruction.",
          credit: "Photo: Unsplash (free to use)",
          placement: "after",
          type: "photo",
        },
      },
    },
  },


  // ==================== LESSON 4 ====================
  // Main Topic: Prenatal Development (Before the First Day of School)
  // Illustrations are attached at chunk level in the lesson document
  // (see lesson-ebs106-l4 draft). Listed here for record/consistency.
  // ====================================================

  lesson_4: {
    chunk_1: {
      // Chunk: "Three Stages of Prenatal Development"
      par_0: {
        illustration: {
          image_url: "/lesson-images/prenatal-stages-timeline.svg",
          alt: "Vertical timeline of the three prenatal stages: Germinal (0-2 weeks), Embryonic (weeks 3-8, greatest teratogen risk), and Fetal (week 9 to birth).",
          caption: "The three stages of prenatal development. Tap or hover a stage for the teacher's note.",
          credit: "Learnda Educational Diagram",
          placement: "after",
          type: "diagram",
        },
      },
    },

    chunk_2: {
      // Chunk: "Teratogens: When the Environment Harms Development"
      par_0: {
        illustration: {
          image_url: "/lesson-images/teratogens-sensitive-periods.svg",
          alt: "Six common teratogens (alcohol, tobacco, drugs, toxins, infections, malnutrition) and a chart showing vulnerability is highest during the embryonic stage.",
          caption: "Six common teratogens and when the foetus is most vulnerable. Tap or hover the bars and cards to explore.",
          credit: "Learnda Educational Diagram",
          placement: "after",
          type: "diagram",
        },
      },
    },
  },


  // ============ EBS 107 — COMPUTER LITERACY ============
  // Lesson 2: What Is a Computer? Types, Classes, and the Brains Behind the Machine
  // =====================================================

  lesson_ebs107_2: {
    chunk_2: {
      // Chunk: "Classifying Computers: Purpose and Type"
      par_0: {
        illustration: {
          image_url: "/lesson-images/computer-classification.svg",
          alt: "Computers classified by purpose (special-purpose vs general-purpose) and by type (analog, digital, hybrid), each with examples.",
          caption: "Two ways to classify computers — by purpose and by operating type. Tap a card to highlight it.",
          credit: "Learnda Learning Diagram",
          placement: "after",
          type: "diagram",
        },
      },
    },
    chunk_3: {
      // Chunk: "From Room-Sized Giants to Pocket Devices: Classification by Size"
      par_0: {
        illustration: {
          image_url: "/lesson-images/computer-size-spectrum.svg",
          alt: "Computers by size from largest to smallest: supercomputer, mainframe, minicomputer, microcomputer, with typical uses.",
          caption: "From supercomputers to smartphones — classifying computers by size. Tap a tier to highlight it.",
          credit: "Learnda Learning Diagram",
          placement: "after",
          type: "diagram",
        },
      },
    },
  },


  // ============ EBS 210 — ALGEBRAIC THINKING ============
  // Lesson 4: The Algebra of Sets
  // =====================================================

  lesson_ebs210_4: {
    chunk_2: {
      // Chunk: "Mixing and Matching: Union, Intersection, and Complement"
      par_0: {
        illustration: {
          image_url: "/lesson-images/sets-operations-venn.svg",
          alt: "Interactive Venn diagram of Science Club S and Debate Club D, with buttons to show Union, Intersection, Difference and Complement.",
          caption: "An interactive Venn diagram — tap Union, Intersection, Difference or Complement to highlight the answer region.",
          credit: "Learnda Learning Diagram",
          placement: "after",
          type: "diagram",
        },
      },
    },
    chunk_3: {
      // Chunk: "Power Sets: The Set of ALL Possible Sets"
      par_0: {
        illustration: {
          image_url: "/lesson-images/sets-power-set.svg",
          alt: "Power sets: the set {1,2} has four subsets, and a set of n elements has 2 to the power n subsets, shown as a doubling chart.",
          caption: "Power sets and the 2ⁿ rule — tap a bar to watch the subset count double.",
          credit: "Learnda Learning Diagram",
          placement: "after",
          type: "diagram",
        },
      },
    },
  },


  // ============ EBS 106 — CHILD DEVELOPMENT (theory lessons) ============
  lesson_10: {
    chunk_3: {
      // Chunk: "Kohlberg's Three Levels of Moral Reasoning"
      par_0: {
        illustration: {
          image_url: "/lesson-images/kohlberg-moral-stages.svg",
          alt: "Kohlberg's three ascending levels of moral reasoning - pre-conventional, conventional, post-conventional - with six stages.",
          caption: "Three levels, six stages — moral reasoning matures upward. Tap a level to highlight it.",
          credit: "Learnda Learning Diagram",
          placement: "after",
          type: "diagram",
        },
      },
    },
  },
  lesson_11: {
    chunk_1: {
      // Chunk: "The Big Idea: Every Stage Has a Crisis"
      par_0: {
        illustration: {
          image_url: "/lesson-images/erikson-psychosocial-stages.svg",
          alt: "Erikson's eight psychosocial stages, each a crisis with a virtue; stage 4, Industry vs Inferiority, happens in the primary classroom.",
          caption: "All eight stages at a glance — note Stage 4, which plays out in your classroom. Tap a stage to highlight it.",
          credit: "Learnda Learning Diagram",
          placement: "after",
          type: "diagram",
        },
      },
    },
  },
  lesson_15: {
    chunk_2: {
      // Chunk: "Pavlov's Discovery"
      par_0: {
        illustration: {
          image_url: "/lesson-images/classical-conditioning-pavlov.svg",
          alt: "Classical conditioning before, during and after: food causes salivation, the bell is paired with food, then the bell alone causes salivation.",
          caption: "How a neutral bell becomes a conditioned stimulus. Tap Before, During and After.",
          credit: "Learnda Learning Diagram",
          placement: "after",
          type: "diagram",
        },
      },
    },
  },
  lesson_16: {
    chunk_2: {
      // Chunk: "Skinner's Operant Conditioning"
      par_0: {
        illustration: {
          image_url: "/lesson-images/operant-conditioning-matrix.svg",
          alt: "A 2x2 matrix of operant conditioning: positive/negative reinforcement and positive/negative punishment.",
          caption: "Reinforcement increases behaviour; punishment decreases it. Tap a quadrant to highlight it.",
          credit: "Learnda Learning Diagram",
          placement: "after",
          type: "diagram",
        },
      },
    },
  },


  // ============ OTHER COURSES ============
  lesson_ebs118_2: {
    chunk_2: {
      // Information Literacy L2: "Information vs. Knowledge"
      par_0: {
        illustration: {
          image_url: "/lesson-images/information-vs-knowledge.svg",
          alt: "The ladder from data to information to knowledge to wisdom, each adding context, meaning or judgement.",
          caption: "Data becomes information, then knowledge, then wisdom. Tap a rung to explore.",
          credit: "Learnda Learning Diagram",
          placement: "after",
          type: "diagram",
        },
      },
    },
  },
  lesson_ebs301j_6: {
    chunk_1: {
      // Calculus L6: "Gradients, Tangents, and Normal Lines"
      par_0: {
        illustration: {
          image_url: "/lesson-images/calculus-tangent-gradient.svg",
          alt: "A curve with a tangent on a rising part (positive gradient), a peak (zero gradient) or a falling part (negative gradient), plus the perpendicular normal.",
          caption: "The gradient is the slope of the tangent. Tap Rising, Peak or Falling to see it change sign.",
          credit: "Learnda Learning Diagram",
          placement: "after",
          type: "diagram",
        },
      },
    },
  },
};

/**
 * Helper: get the illustration for a specific lesson chunk paragraph
 * @param {number} lessonNumber - e.g. 1, 2, 3
 * @param {string} chunkKey    - e.g. "chunk_0"
 * @param {string} parKey      - e.g. "par_0"
 * @returns {object|null}      - illustration object or null
 */
export function getIllustration(lessonNumber, chunkKey, parKey) {
  const lesson = lessonImageManifest[`lesson_${lessonNumber}`];
  if (!lesson) return null;
  const chunk = lesson[chunkKey];
  if (!chunk) return null;
  const par = chunk[parKey];
  if (!par) return null;
  return par.illustration || null;
}
