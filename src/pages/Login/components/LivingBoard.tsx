import { useState, useEffect, useMemo, useRef } from "react";
import {
  AnimatePresence,
  motion,
  LayoutGroup,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type PanInfo,
} from "motion/react";
import { SPRING_ENTER, SPRING_DRIFT } from "../motion";
import styles from "./LivingBoard.module.scss";

type ColumnId = "todo" | "in_progress" | "done";

interface KanbanCard {
  id: string;
  title: string;
  budgetLabel: string;
  columnId: ColumnId;
  progress: number;
  avatars: string[];
  statusLabel: string;
}

const COLUMN_CONFIG: Record<ColumnId, { progress: number; statusLabel: string }> = {
  todo: {
    progress: 0.24,
    statusLabel: "Queued",
  },
  in_progress: {
    progress: 0.66,
    statusLabel: "In Progress",
  },
  done: {
    progress: 1.0,
    statusLabel: "Completed",
  },
};

// Seed TO DO: 2, IN PROGRESS: 2, DONE: 2 (Total 6 cards = ₱3,000,000.00)
const INITIAL_CARDS: KanbanCard[] = [
  {
    id: "card-1",
    title: "City Hall Solar Inspection",
    budgetLabel: "₱620,000",
    columnId: "todo",
    progress: 0.24,
    avatars: ["DG", "FB"],
    statusLabel: "Drafting",
  },
  {
    id: "card-2",
    title: "Ormoc Port Wharf Permit",
    budgetLabel: "₱840,000",
    columnId: "todo",
    progress: 0.34,
    avatars: ["JC", "AL"],
    statusLabel: "Queued",
  },
  {
    id: "card-3",
    title: "Budget Allocation Q3",
    budgetLabel: "₱480,000",
    columnId: "in_progress",
    progress: 0.62,
    avatars: ["AL", "KC"],
    statusLabel: "In Review",
  },
  {
    id: "card-4",
    title: "Disaster Risk Map Update",
    budgetLabel: "₱310,000",
    columnId: "in_progress",
    progress: 0.78,
    avatars: ["MR", "DG"],
    statusLabel: "In Progress",
  },
  {
    id: "card-5",
    title: "Review Ordinance 2026-08",
    budgetLabel: "₱290,000",
    columnId: "done",
    progress: 1.0,
    avatars: ["JC", "MR"],
    statusLabel: "Approved",
  },
  {
    id: "card-6",
    title: "Business Permit Automation",
    budgetLabel: "₱460,000",
    columnId: "done",
    progress: 1.0,
    avatars: ["FB", "TB"],
    statusLabel: "Completed",
  },
];

const COLUMNS: { id: ColumnId; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
];

export interface LivingBoardProps {
  organizationName?: string;
}

export function LivingBoard({ organizationName = "LEDIPO" }: LivingBoardProps) {
  const shouldReduceMotion = useReducedMotion();
  const [cards, setCards] = useState<KanbanCard[]>(INITIAL_CARDS);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [hoveredColumnId, setHoveredColumnId] = useState<ColumnId | null>(null);

  const columnRefs = useRef<Record<ColumnId, HTMLDivElement | null>>({
    todo: null,
    in_progress: null,
    done: null,
  });

  const cycleStepRef = useRef(0);
  const lastInteractionRef = useRef(0);
  const isHoveringBoardRef = useRef(false);
  const isDraggingRef = useRef(false);
  const colPickRef = useRef<Record<ColumnId, number>>({
    todo: 0,
    in_progress: 0,
    done: 0,
  });

  // Subtle interactive 3D tilt matching the landing page board
  const tiltX = useMotionValue(4);
  const tiltY = useMotionValue(-5);
  const smoothTiltX = useSpring(tiltX, { stiffness: 130, damping: 22 });
  const smoothTiltY = useSpring(tiltY, { stiffness: 130, damping: 22 });

  const handleBoardPointerMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || isDraggingRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width - 0.5;
    const ny = (event.clientY - rect.top) / rect.height - 0.5;
    tiltX.set(2 - ny * 6);
    tiltY.set(-2 + nx * 7);
  };

  const handleBoardPointerLeave = () => {
    isHoveringBoardRef.current = false;
    tiltX.set(4);
    tiltY.set(-5);
  };

  const getTargetColumn = (clientX: number): ColumnId | null => {
    const todoEl = columnRefs.current.todo;
    const inProgEl = columnRefs.current.in_progress;
    const doneEl = columnRefs.current.done;

    if (!todoEl || !inProgEl || !doneEl) return null;

    const todoRect = todoEl.getBoundingClientRect();
    const inProgRect = inProgEl.getBoundingClientRect();
    const doneRect = doneEl.getBoundingClientRect();

    if (clientX < todoRect.left - 60 || clientX > doneRect.right + 60) {
      return null;
    }

    const boundary1 = (todoRect.right + inProgRect.left) / 2;
    const boundary2 = (inProgRect.right + doneRect.left) / 2;

    if (clientX < boundary1) return "todo";
    if (clientX < boundary2) return "in_progress";
    return "done";
  };

  const moveCardToColumn = (cardId: string, targetColId: ColumnId) => {
    lastInteractionRef.current = Date.now();
    setCards((prev) => {
      const cardIndex = prev.findIndex((c) => c.id === cardId);
      if (cardIndex === -1) return prev;
      const card = prev[cardIndex];
      if (card.columnId === targetColId) return prev;

      const config = COLUMN_CONFIG[targetColId];
      const updatedCard: KanbanCard = {
        ...card,
        columnId: targetColId,
        progress: config.progress,
        statusLabel: config.statusLabel,
      };

      const remaining = prev.filter((c) => c.id !== cardId);
      remaining.push(updatedCard);
      return remaining;
    });
  };

  // Gentle 1-card-at-a-time autonomous flow (pauses while hovering or dragging)
  useEffect(() => {
    if (shouldReduceMotion) return;

    const pickFromColumn = (items: KanbanCard[], colId: ColumnId): KanbanCard => {
      const idx = colPickRef.current[colId] % items.length;
      colPickRef.current[colId] = (idx + 1) % items.length;
      return items[idx];
    };

    const interval = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (isDraggingRef.current || isHoveringBoardRef.current) return;
      if (Date.now() - lastInteractionRef.current < 2200) return;

      setCards((prev) => {
        const next = prev.map((c) => ({ ...c }));
        const todo = next.filter((c) => c.columnId === "todo");
        const inProgress = next.filter((c) => c.columnId === "in_progress");
        const done = next.filter((c) => c.columnId === "done");

        const applyCol = (card: KanbanCard, target: ColumnId) => {
          const cfg = COLUMN_CONFIG[target];
          card.columnId = target;
          card.progress = cfg.progress;
          card.statusLabel = cfg.statusLabel;
        };

        if (inProgress.length === 0 && (todo.length > 1 || done.length > 1)) {
          const source =
            todo.length > 1 ? pickFromColumn(todo, "todo") : pickFromColumn(done, "done");
          applyCol(source, "in_progress");
          return next;
        }

        const step = cycleStepRef.current % 3;
        if (step === 0 && inProgress.length > 1) {
          applyCol(pickFromColumn(inProgress, "in_progress"), "done");
          cycleStepRef.current++;
        } else if (step === 1 && done.length > 1) {
          applyCol(pickFromColumn(done, "done"), "todo");
          cycleStepRef.current++;
        } else if (step === 2 && todo.length > 1) {
          applyCol(pickFromColumn(todo, "todo"), "in_progress");
          cycleStepRef.current++;
        } else if (inProgress.length > 1) {
          applyCol(pickFromColumn(inProgress, "in_progress"), "done");
        } else if (todo.length > 1) {
          applyCol(pickFromColumn(todo, "todo"), "in_progress");
        } else if (done.length > 1) {
          applyCol(pickFromColumn(done, "done"), "todo");
        }
        return next;
      });
    }, 3400);

    return () => clearInterval(interval);
  }, [shouldReduceMotion]);

  const columnCounts = useMemo(
    () => ({
      todo: cards.filter((c) => c.columnId === "todo").length,
      in_progress: cards.filter((c) => c.columnId === "in_progress").length,
      done: cards.filter((c) => c.columnId === "done").length,
    }),
    [cards],
  );

  const handleDragStart = (cardId: string) => {
    isDraggingRef.current = true;
    lastInteractionRef.current = Date.now();
    setDraggingCardId(cardId);
    tiltX.set(0);
    tiltY.set(0);
  };

  const handleDrag = (_e: unknown, info: PanInfo) => {
    const colId = getTargetColumn(info.point.x);
    setHoveredColumnId(colId);
  };

  const handleDragEnd = (card: KanbanCard, _e: unknown, info: PanInfo) => {
    isDraggingRef.current = false;
    setDraggingCardId(null);
    setHoveredColumnId(null);
    lastInteractionRef.current = Date.now();

    const targetColId = getTargetColumn(info.point.x);
    if (targetColId && targetColId !== card.columnId) {
      moveCardToColumn(card.id, targetColId);
    }
  };

  const draggingSourceColId = cards.find((c) => c.id === draggingCardId)?.columnId;

  return (
    <div
      className={styles.boardWrapper}
      role="region"
      aria-label="Interactive project preview board"
    >
      <motion.div
        className={styles.boardShell}
        style={
          shouldReduceMotion
            ? undefined
            : {
                rotateX: smoothTiltX,
                rotateY: smoothTiltY,
              }
        }
        onMouseEnter={() => {
          isHoveringBoardRef.current = true;
        }}
        onMouseMove={handleBoardPointerMove}
        onMouseLeave={handleBoardPointerLeave}
      >
        {/* Crisp Board Top Header matching the Landing Page */}
        <div className={styles.boardHeader}>
          <div className={styles.boardHeaderLeft}>
            <span className={styles.boardSquare} aria-hidden="true" />
            <span className={styles.boardTitle}>{organizationName} · Q3 Workplan</span>
          </div>
          <span className={styles.boardMetaBadge}>FY 2026 · {cards.length} Tasks</span>
        </div>

        {/* Three-Column Kanban Body */}
        <div className={styles.boardContainer}>
          <LayoutGroup id="eflow-kanban-board">
            {COLUMNS.map((column) => {
              const columnCards = cards.filter((c) => c.columnId === column.id);
              const count = columnCounts[column.id];
              const isDropTarget = hoveredColumnId === column.id && draggingCardId !== null;
              const isSourceColumn = column.id === draggingSourceColId;
              const isDoneCol = column.id === "done";

              return (
                <div
                  key={column.id}
                  ref={(el) => {
                    columnRefs.current[column.id] = el;
                  }}
                  data-column-id={column.id}
                  className={`${styles.column} ${isDropTarget ? styles.isDropTarget : ""} ${
                    isSourceColumn ? styles.isSourceColumn : ""
                  }`}
                  style={{
                    zIndex: isSourceColumn ? 100 : 1,
                  }}
                >
                  <div className={styles.columnHeader}>
                    <span className={styles.columnTitle}>{column.label}</span>
                    <span
                      className={`${styles.columnBadge} ${
                        isDoneCol && count === cards.length ? styles.columnBadgeDone : ""
                      }`}
                    >
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={count}
                          initial={shouldReduceMotion ? false : { y: -10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={shouldReduceMotion ? undefined : { y: 10, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 360, damping: 26 }}
                        >
                          {count}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                  </div>

                  <div
                    className={`${styles.cardList} ${
                      !isSourceColumn && columnCards.length >= 5 ? styles.cardListScrollable : ""
                    }`}
                  >
                    {columnCards.map((card) => {
                      const isTodo = card.columnId === "todo";
                      const isProgress = card.columnId === "in_progress";
                      const isDone = card.columnId === "done";
                      const isThisDragging = draggingCardId === card.id;

                      return (
                        <motion.div
                          layout="position"
                          layoutId={card.id}
                          key={card.id}
                          data-card-id={card.id}
                          className={`${styles.card} ${
                            isTodo
                              ? styles.cardTodo
                              : isProgress
                                ? styles.cardProgress
                                : styles.cardDone
                          } ${isThisDragging ? styles.isDragging : ""}`}
                          style={{
                            zIndex: isThisDragging ? 9999 : 2,
                          }}
                          drag
                          dragSnapToOrigin
                          dragElastic={0.14}
                          dragTransition={{ bounceStiffness: 480, bounceDamping: 38 }}
                          whileHover={
                            shouldReduceMotion
                              ? undefined
                              : {
                                  scale: 1.015,
                                  y: -2,
                                  transition: { duration: 0.15 },
                                }
                          }
                          whileTap={
                            shouldReduceMotion
                              ? undefined
                              : {
                                  scale: 0.985,
                                }
                          }
                          whileDrag={{
                            scale: 1.04,
                            rotate: 1.2,
                            zIndex: 9999,
                            boxShadow:
                              "0 26px 52px rgba(10, 16, 40, 0.34), 0 8px 20px rgba(10, 16, 40, 0.16)",
                            cursor: "grabbing",
                          }}
                          onDragStart={() => handleDragStart(card.id)}
                          onDrag={(_e, info) => handleDrag(_e, info)}
                          onDragEnd={(_e, info) => handleDragEnd(card, _e, info)}
                          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.95 }}
                          animate={
                            isDone && !shouldReduceMotion
                              ? {
                                  opacity: 1,
                                  scale: [1, 1.025, 1],
                                  transition: { duration: 0.3, ease: "easeInOut" },
                                }
                              : { opacity: 1, scale: 1, transition: SPRING_ENTER }
                          }
                          transition={{ type: "spring", stiffness: 360, damping: 32, mass: 0.75 }}
                        >
                          <div className={styles.cardHeader}>
                            <span className={styles.cardTitle}>{card.title}</span>
                            <div className={styles.cardHeaderRight}>
                              <span className={styles.cardBudget}>{card.budgetLabel}</span>
                              <div
                                className={styles.dragHandle}
                                title="Drag to move task"
                                aria-hidden="true"
                              >
                                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                                  <circle cx="5" cy="3" r="1.5" />
                                  <circle cx="11" cy="3" r="1.5" />
                                  <circle cx="5" cy="8" r="1.5" />
                                  <circle cx="11" cy="8" r="1.5" />
                                  <circle cx="5" cy="13" r="1.5" />
                                  <circle cx="11" cy="13" r="1.5" />
                                </svg>
                              </div>
                            </div>
                          </div>

                          <div
                            className={`${styles.progressTrack} ${
                              isProgress ? styles.progressTrackAmber : ""
                            }`}
                          >
                            <motion.div
                              className={`${styles.progressBar} ${
                                isTodo
                                  ? styles.progressBarTodo
                                  : isProgress
                                    ? styles.progressBarProgress
                                    : styles.progressBarDone
                              }`}
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: card.progress }}
                              transition={SPRING_DRIFT}
                            />
                          </div>

                          <div className={styles.cardFooter}>
                            <span
                              className={`${styles.statusPill} ${
                                isTodo
                                  ? styles.pillTodo
                                  : isProgress
                                    ? styles.pillProgress
                                    : styles.pillDone
                              }`}
                            >
                              {isDone && (
                                <svg
                                  className={styles.checkIcon}
                                  width="11"
                                  height="11"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  aria-hidden="true"
                                >
                                  <motion.path
                                    d="M3.2 8.4L6.6 11.8L13 4.8"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    initial={
                                      shouldReduceMotion
                                        ? { pathLength: 1 }
                                        : { pathLength: 0 }
                                    }
                                    animate={{ pathLength: 1 }}
                                    transition={{ duration: 0.32, ease: "easeOut" }}
                                  />
                                </svg>
                              )}
                              <span>{card.statusLabel}</span>
                            </span>

                            <div className={styles.avatarStack} aria-hidden="true">
                              {card.avatars.map((av, idx) => (
                                <div key={idx} className={styles.avatar}>
                                  {av}
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </LayoutGroup>
        </div>
      </motion.div>
    </div>
  );
}

export default LivingBoard;
