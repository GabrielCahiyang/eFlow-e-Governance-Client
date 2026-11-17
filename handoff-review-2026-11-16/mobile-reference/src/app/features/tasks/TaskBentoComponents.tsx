import { useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import Calendar from "lucide-react-native/icons/calendar";
import UserPlus from "lucide-react-native/icons/user-plus";
import Trash2 from "lucide-react-native/icons/trash";
import { Button } from "../../components/ui/Button";
import { BusyIndicator } from "../../components/ui/BusyIndicator";
import { SmallProgress } from "../../components/ui/OperationStatus";
import Activity from "lucide-react-native/icons/activity";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import Wallet from "lucide-react-native/icons/wallet";
import Files from "lucide-react-native/icons/files";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Plus from "lucide-react-native/icons/plus";
import Pencil from "lucide-react-native/icons/pencil";
import Check from "lucide-react-native/icons/check";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import ListCollapse from "lucide-react-native/icons/list-collapse";
import Link2 from "lucide-react-native/icons/link-2";
import CircleIcon from "lucide-react-native/icons/circle";
import SlidersHorizontal from "lucide-react-native/icons/sliders-horizontal";
import { Text } from "../../components/ui/Typography";
import { useTheme } from "../../components/ui/Appearance";
import { Sheet } from "../../components/ui/Sheet";
import { statusIndicatorColor } from "../../components/ui/Status";
import { useWorkStatus } from "../../shared/workStatusPresentation";
import { isRawEntityId } from "../../shared/entityId";
import { dateLabel } from "../../components/ui/theme";
import { workDay } from "../../../core/web/app/shared/workCalendar";
import type { WorkPerson } from "../../../core/web/app/features/nested-work/types";

export function priorityLabel(priority?: string): string {
  if (!priority || priority === "normal" || priority === "medium")
    return "Medium";
  if (priority === "high") return "High";
  if (priority === "urgent") return "Urgent";
  if (priority === "low") return "Low";
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const avatarPalette = [
  { bg: "#16213E", text: "#93C5FD" },
  { bg: "#132E27", text: "#86EFAC" },
  { bg: "#261E38", text: "#D8B4FE" },
  { bg: "#2E2015", text: "#FDBA74" },
  { bg: "#1A2B4C", text: "#7DD3FC" },
  { bg: "#2C1A2E", text: "#F472B6" },
];

export function AvatarBadge({
  name,
  size = 36,
  fontSize,
}: {
  name: string;
  size?: number;
  fontSize?: number;
}) {
  const initials = getInitials(name);
  const colorIndex =
    Math.abs(
      name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0),
    ) % avatarPalette.length;
  const tone = avatarPalette[colorIndex];
  const fs = fontSize || Math.max(10, Math.round(size * 0.38));

  return (
    <View
      accessible
      accessibilityLabel={`Avatar for ${name}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tone.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: fs,
          fontWeight: "700",
          color: tone.text,
          lineHeight: fs + 2,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

export function CircularProgressRing({
  percent,
  size = 50,
  strokeWidth = 4,
  accessibilityLabel,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  accessibilityLabel?: string;
}) {
  const palette = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      accessibilityLabel={accessibilityLabel || `Task completion: ${clamped}%`}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg
        width={size}
        height={size}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={palette.border}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.4}
        />
        {clamped > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={palette.primary}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : (
          <Circle
            cx={size / 2}
            cy={strokeWidth / 2 + 1}
            r={strokeWidth / 2 + 1}
            fill={palette.primary}
          />
        )}
      </Svg>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "700",
          color: palette.text,
        }}
      >
        {clamped}%
      </Text>
    </View>
  );
}

export interface BentoAction {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  icon?: "pencil" | "check" | "plus" | "sliders";
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
}

export function BentoActionButtons({
  actions,
  style,
}: {
  actions: (BentoAction | null | undefined | false)[];
  style?: StyleProp<ViewStyle>;
}) {
  const palette = useTheme();
  const { fontScale } = useWindowDimensions();
  const validActions = actions.filter((action): action is BentoAction =>
    Boolean(action && typeof action === "object"),
  );

  if (validActions.length === 0) return null;

  return (
    <View
      style={[
        {
          flexDirection: fontScale > 1.8 ? "column" : "row",
          gap: 10,
          marginVertical: 10,
        },
        style,
      ]}
    >
      {validActions.map((action, index) => {
        const isPrimary = action.variant === "primary";
        const bg = isPrimary ? palette.primary : palette.surface;
        const border = isPrimary ? palette.primary : palette.border;
        const textColor = isPrimary ? palette.onPrimary : palette.text;
        const iconColor = isPrimary ? palette.onPrimary : palette.text;

        return (
          <Pressable
            key={`${action.label}-${index}`}
            accessibilityRole="button"
            accessibilityLabel={action.accessibilityLabel || action.label}
            accessibilityState={{
              disabled: action.disabled,
              busy: action.busy,
            }}
            disabled={action.disabled || action.busy}
            onPress={action.onPress}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              minHeight: 44,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: bg,
              borderWidth: 1,
              borderColor: border,
              opacity: action.disabled ? 0.5 : pressed ? 0.8 : 1,
            })}
          >
            {action.icon === "pencil" && (
              <Pencil size={15} color={iconColor} strokeWidth={2.2} />
            )}
            {action.icon === "check" && (
              <Check size={16} color={iconColor} strokeWidth={2.4} />
            )}
            {action.icon === "plus" && (
              <Plus size={16} color={iconColor} strokeWidth={2.2} />
            )}
            {action.icon === "sliders" && (
              <SlidersHorizontal size={15} color={iconColor} strokeWidth={2.2} />
            )}
            <Text
              numberOfLines={1}
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: textColor,
              }}
            >
              {action.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Compact outlined "Edit" button placed beside Task and Subtask detail titles.
 */
export function BentoEditButton({
  onPress,
  accessibilityLabel = "Edit",
  disabled = false,
  busy = false,
}: {
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  busy?: boolean;
}) {
  const palette = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || busy, busy }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        minHeight: 48,
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      {busy ? <BusyIndicator size={14} color={palette.text} /> : <Pencil size={14} color={palette.text} strokeWidth={2.2} />}
      <Text
        numberOfLines={1}
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: palette.text,
        }}
      >
        Edit
      </Text>
    </Pressable>
  );
}

export function BentoDeleteButton({ onPress, accessibilityLabel, disabled, busy }: {
  onPress: () => void; accessibilityLabel: string; disabled?: boolean; busy?: boolean;
}) {
  const palette = useTheme();
  return <Button variant="outline" accessibilityLabel={accessibilityLabel} onPress={onPress}
    disabled={disabled} busy={busy} icon={<Trash2 size={14} color={palette.danger} />}
    style={{ minHeight: 48, paddingHorizontal: 11, borderRadius: 10 }}
    textStyle={{ fontSize: 13, color: palette.danger }}>Delete</Button>;
}

export interface DependencyItemData {
  id: string;
  title: string;
  status: string;
  completed?: boolean;
  projectId?: string;
}

/**
 * Conditional prerequisite dependencies card positioned directly below the date cards.
 */
export function BentoDependenciesCard({
  items,
  missingCount = 0,
  pendingCount,
  onPressItem,
}: {
  items: DependencyItemData[];
  missingCount?: number;
  pendingCount?: number;
  onPressItem?: (item: DependencyItemData) => void;
}) {
  const palette = useTheme();
  const total = items.length + missingCount;
  if (total === 0) return null;

  const completedCount = items.filter(
    (item) => item.completed || item.status === "completed",
  ).length;
  const allComplete = pendingCount === undefined
    ? completedCount === total && missingCount === 0
    : pendingCount === 0;

  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: 14,
        padding: 14,
        gap: 10,
        marginBottom: 12,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Link2 size={14} color={palette.muted} />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: palette.muted,
              letterSpacing: 0.4,
            }}
          >
            DEPENDENCIES
          </Text>
        </View>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: allComplete ? palette.success : palette.warning,
          }}
        >
          {pendingCount === undefined
            ? `${completedCount} of ${total} complete`
            : `${pendingCount} pending`}
        </Text>
      </View>

      <View style={{ gap: 6 }}>
        {items.map((item) => {
          const isDone = Boolean(item.completed || item.status === "completed");
          const rowContent = (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 6,
                paddingHorizontal: 8,
                borderRadius: 8,
                backgroundColor: palette.background,
              }}
            >
              {isDone ? (
                <Check size={14} color={palette.success} strokeWidth={2.5} />
              ) : (
                <CircleIcon size={13} color={palette.muted} strokeWidth={2} />
              )}
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: "500",
                  color: isDone ? palette.muted : palette.text,
                  textDecorationLine: isDone ? "line-through" : "none",
                }}
              >
                {item.title}
              </Text>
              {onPressItem && (
                <ChevronRight size={14} color={palette.muted} />
              )}
            </View>
          );

          if (!onPressItem) {
            return <View key={item.id}>{rowContent}</View>;
          }

          return (
            <Pressable
              key={item.id}
              onPress={() => onPressItem(item)}
              accessibilityRole="button"
              accessibilityLabel={`Open dependency ${item.title}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              {rowContent}
            </Pressable>
          );
        })}

        {missingCount > 0 && (
          <Text
            style={{
              fontSize: 12,
              color: palette.muted,
              paddingHorizontal: 4,
            }}
          >
            +{missingCount} restricted or unavailable prerequisite
            {missingCount === 1 ? "" : "s"}
          </Text>
        )}
      </View>
    </View>
  );
}

export function BentoBlockerCard({
  blocker,
  reporter,
  reportedAt,
  note,
  nextStep,
  onPressActivity,
}: {
  blocker?: string | null;
  reporter?: string | null;
  reportedAt?: string | number | null;
  note?: string | null;
  nextStep?: string | null;
  onPressActivity?: () => void;
}) {
  const palette = useTheme();
  if (!blocker) return null;

  const metaParts = [
    reporter?.trim(),
    reportedAt ? dateLabel(reportedAt) || String(reportedAt) : null,
  ].filter(Boolean);

  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: palette.dangerSoft || "rgba(239, 68, 68, 0.1)",
        borderWidth: 1,
        borderColor: palette.danger,
        borderRadius: 14,
        padding: 14,
        gap: 6,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <TriangleAlert size={16} color={palette.danger} />
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: palette.danger,
            letterSpacing: 0.5,
          }}
        >
          WORK BLOCKED
        </Text>
      </View>
      <Text
        selectable
        style={{
          fontSize: 14,
          color: palette.text,
          lineHeight: 20,
        }}
      >
        {blocker}
      </Text>
      {metaParts.length > 0 && (
        <Text style={{ fontSize: 12, color: palette.mutedLabel }}>
          {metaParts.join(" · ")}
        </Text>
      )}
      {!!note?.trim() && (
        <Text selectable style={{ fontSize: 13, color: palette.muted }}>
          Note: {note.trim()}
        </Text>
      )}
      {!!nextStep?.trim() && (
        <Text selectable style={{ fontSize: 13, color: palette.muted }}>
          Next step: {nextStep.trim()}
        </Text>
      )}
      {onPressActivity && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View blocker activity"
          onPress={onPressActivity}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-start",
            gap: 4,
            paddingTop: 2,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: palette.danger,
            }}
          >
            Activity & evidence
          </Text>
          <ChevronRight size={14} color={palette.danger} />
        </Pressable>
      )}
    </View>
  );
}

export function BentoProjectOnHoldCard({
  projectId,
  onNavigateReadiness,
  onNavigateParentTask,
  style,
  waitingForTask = false,
  isTaskLead = false,
}: {
  projectId?: string;
  onNavigateReadiness?: () => void;
  onNavigateParentTask?: () => void;
  style?: StyleProp<ViewStyle>;
  waitingForTask?: boolean;
  isTaskLead?: boolean;
}) {
  const palette = useTheme();

  return (
    <View
      accessibilityRole="alert"
      style={[
        {
          backgroundColor: palette.warningSoft || "rgba(245, 158, 11, 0.12)",
          borderWidth: 1,
          borderColor: palette.warning || "#F59E0B",
          borderRadius: 14,
          padding: 14,
          gap: 6,
          marginTop: 8,
          marginBottom: 8,
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
          <TriangleAlert size={16} color={palette.warning || "#F59E0B"} />
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: palette.text,
              flexShrink: 1,
            }}
          >
            {waitingForTask ? "Waiting for the parent task" : "Project on hold"}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: palette.warningSoft || "rgba(245, 158, 11, 0.18)",
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 6,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: palette.warning || "#D97706",
              letterSpacing: 0.3,
            }}
          >
            Work actions unavailable
          </Text>
        </View>
      </View>
      <Text
        selectable
        style={{
          fontSize: 13,
          color: palette.muted,
          lineHeight: 18,
        }}
      >
        {waitingForTask
          ? isTaskLead
            ? "You're the Task Lead. Start the parent task first before you can update or complete this subtask."
            : "The Task Lead must start the parent task before you can update or complete this subtask."
          : "Work updates are paused while the project is under review."}
      </Text>
      {waitingForTask && onNavigateParentTask && (
        <Pressable
          onPress={onNavigateParentTask}
          accessibilityRole="button"
          accessibilityLabel="Go to Task details"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            alignSelf: "flex-start",
            marginTop: 4,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: palette.primary,
            }}
          >
            Go to Task details
          </Text>
          <ChevronRight size={14} color={palette.primary} />
        </Pressable>
      )}
      {onNavigateReadiness && (
        <Pressable
          onPress={onNavigateReadiness}
          accessibilityRole="button"
          accessibilityLabel="Review project readiness"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            alignSelf: "flex-start",
            marginTop: 4,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: palette.primary,
            }}
          >
            Review project readiness
          </Text>
          <ChevronRight size={14} color={palette.primary} />
        </Pressable>
      )}
    </View>
  );
}

export function BentoScheduleCards({
  startDate,
  dueDate,
  workTimezone,
}: {
  startDate?: string | null;
  dueDate?: string | null;
  workTimezone?: string;
}) {
  const palette = useTheme();
  const { fontScale } = useWindowDimensions();
  const format = (value?: string | null) => {
    if (!value) return "—";
    if (!workTimezone)
      return dateLabel(value.includes("T") ? value : value + "T12:00:00");
    const day = workDay(value, workTimezone);
    return day === null ? "—" : new Intl.DateTimeFormat("en-PH", {
      timeZone: "UTC", year: "numeric", month: "short", day: "numeric",
    }).format(day * 86400000);
  };

  return (
    <View
      style={{
        flexDirection: fontScale > 1.8 ? "column" : "row",
        gap: 12,
        marginBottom: 12,
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.border,
          borderRadius: 14,
          padding: 14,
          gap: 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Calendar size={14} color={palette.mutedLabel} />
          <Text
            style={{
              fontSize: 12,
              color: palette.mutedLabel,
              fontWeight: "500",
            }}
          >
            Start date
          </Text>
        </View>
        <Text
          numberOfLines={1}
          style={{ fontSize: 15, fontWeight: "700", color: palette.text }}
        >
          {format(startDate)}
        </Text>
      </View>

      <View
        style={{
          flex: 1,
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.border,
          borderRadius: 14,
          padding: 14,
          gap: 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Calendar size={14} color={palette.mutedLabel} />
          <Text
            style={{
              fontSize: 12,
              color: palette.mutedLabel,
              fontWeight: "500",
            }}
          >
            Due date
          </Text>
        </View>
        <Text
          numberOfLines={1}
          style={{ fontSize: 15, fontWeight: "700", color: palette.text }}
        >
          {format(dueDate)}
        </Text>
      </View>
    </View>
  );
}

export function ContributorsSheet({
  open,
  onClose,
  contributors,
}: {
  open: boolean;
  onClose: () => void;
  contributors: readonly { id?: string; name: string; office?: string }[];
}) {
  const palette = useTheme();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Contributors"
      description={`${contributors.length} assigned ${contributors.length === 1 ? "contributor" : "contributors"}`}
    >
      <ScrollView
        style={{ maxHeight: 380 }}
        contentContainerStyle={{ gap: 12, paddingVertical: 8 }}
      >
        {contributors.length > 0 ? (
          contributors.map((person, index) => (
            <View
              key={person.id || person.name || index}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 6,
                borderBottomWidth: index === contributors.length - 1 ? 0 : 0.5,
                borderColor: palette.border,
              }}
            >
              <AvatarBadge name={person.name} size={38} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: palette.text,
                  }}
                >
                  {person.name}
                </Text>
                <Text style={{ fontSize: 12, color: palette.mutedLabel }}>
                  Contributor
                  {person.office && !isRawEntityId(person.office) && person.office !== person.id
                    ? ` · ${person.office}`
                    : ""}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={{ color: palette.mutedLabel, paddingVertical: 12 }}>
            No contributors assigned to this task.
          </Text>
        )}
      </ScrollView>
    </Sheet>
  );
}

export function BentoAssignedTeamCard({
  leadName,
  leadRoleLabel = "Task Lead",
  contributors,
  onChoosePeople,
  peoplePending = false,
}: {
  leadName?: string | null;
  leadRoleLabel?: string;
  contributors: readonly { id?: string; name: string; office?: string }[];
  onChoosePeople?: () => void;
  peoplePending?: boolean;
}) {
  const palette = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const visibleContributors = contributors.slice(0, 3);
  const extraCount = Math.max(0, contributors.length - 3);

  let previewText = "No contributors assigned";
  if (contributors.length > 0) {
    if (contributors.length <= 3) {
      previewText = contributors.map((p) => p.name).join(", ");
    } else {
      const firstNames = contributors
        .slice(0, 3)
        .map((p) => p.name.split(" ")[0])
        .join(", ");
      previewText = `${firstNames} +${extraCount} others`;
    }
  }

  return (
    <>
      <View
        style={{
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.border,
          borderRadius: 14,
          padding: 16,
          gap: 14,
          marginBottom: 12,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{ fontSize: 16, fontWeight: "700", color: palette.text }}
          >
            Assigned team
          </Text>
          {!!onChoosePeople && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose people for this task"
              disabled={peoplePending}
              accessibilityState={{ disabled: peoplePending, busy: peoplePending }}
              onPress={onChoosePeople}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                minHeight: 36,
                paddingHorizontal: 8,
              }}
            >
              {peoplePending ? <BusyIndicator size={14} color={palette.primary} /> : <UserPlus size={14} color={palette.primary} />}
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: palette.primary,
                }}
              >
                Choose people
              </Text>
            </Pressable>
          )}
          {!onChoosePeople && peoplePending && <SmallProgress label="Checking actions…" />}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <AvatarBadge name={leadName || "Needs assignment"} size={40} />
          <View style={{ gap: 2, flex: 1 }}>
            <Text
              style={{ fontSize: 15, fontWeight: "700", color: palette.text }}
            >
              {leadName || "Needs assignment"}
            </Text>
            <Text style={{ fontSize: 12, color: palette.mutedLabel }}>
              {leadRoleLabel}
            </Text>
          </View>
        </View>

        <View
          style={{ height: 1, backgroundColor: palette.border, opacity: 0.6 }}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Contributors: ${previewText}, view all ${contributors.length} contributors`}
          onPress={() => setSheetOpen(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 44,
          }}
        >
          <View style={{ gap: 3, flex: 1, paddingRight: 8 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: "700", color: palette.text }}
              >
                Contributors
              </Text>
              {contributors.length > 0 && (
                <View
                  style={{
                    backgroundColor: palette.primarySoft,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 999,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: palette.primary,
                    }}
                  >
                    {contributors.length}
                  </Text>
                </View>
              )}
            </View>
            <Text
              numberOfLines={1}
              style={{ fontSize: 12, color: palette.mutedLabel }}
            >
              {previewText}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {contributors.length > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {visibleContributors.map((person, index) => (
                  <View
                    key={person.id || person.name || index}
                    style={{
                      marginLeft: index === 0 ? 0 : -8,
                      borderWidth: 2,
                      borderColor: palette.surface,
                      borderRadius: 999,
                      zIndex: visibleContributors.length - index,
                    }}
                  >
                    <AvatarBadge name={person.name} size={28} />
                  </View>
                ))}
                {extraCount > 0 && (
                  <View
                    style={{
                      marginLeft: -8,
                      borderWidth: 2,
                      borderColor: palette.surface,
                      borderRadius: 999,
                      backgroundColor: palette.primarySoft,
                      minWidth: 28,
                      height: 28,
                      paddingHorizontal: 4,
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 0,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: palette.primary,
                      }}
                    >
                      +{extraCount}
                    </Text>
                  </View>
                )}
              </View>
            )}
            <ChevronRight size={16} color={palette.mutedLabel} />
          </View>
        </Pressable>
      </View>

      <ContributorsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        contributors={contributors}
      />
    </>
  );
}

export interface SubtaskItemData {
  id: string;
  title: string;
  status: string;
  customStatusId?: string | null;
  percent?: number;
  members: readonly WorkPerson[];
}

export function BentoSubtasksCard({
  title = "Subtasks",
  subtasks,
  canAdd,
  onAddSubtask,
  onPressSubtask,
  actionsPending = false,
}: {
  title?: string;
  subtasks: readonly SubtaskItemData[];
  canAdd?: boolean;
  onAddSubtask?: () => void;
  onPressSubtask: (subtask: SubtaskItemData) => void;
  actionsPending?: boolean;
}) {
  const palette = useTheme();
  const resolveStatus = useWorkStatus();
  const [allOpen, setAllOpen] = useState(false);
  const rows = (items: readonly SubtaskItemData[]) => (
    <View style={{ gap: 2 }}>
      {items.map((item, index) => {
        const label = resolveStatus(item.status, item.customStatusId).label;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`Subtask: ${item.title}, ${label}`}
            onPress={() => {
              setAllOpen(false);
              onPressSubtask(item);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 10,
              gap: 6,
              borderTopWidth: index === 0 ? 0 : 0.5,
              borderColor: palette.border,
            }}
          >
            <View style={{ gap: 3, flex: 1 }}>
              <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: "600", color: palette.text }}>
                {item.title}
              </Text>
              <Text style={{ fontSize: 12, color: statusIndicatorColor(item.status, palette) }}>
                {label}
              </Text>
            </View>
            {item.members.slice(0, 3).map((person) => (
              <AvatarBadge key={person.id} name={person.name} size={24} />
            ))}
            <ChevronRight size={16} color={palette.mutedLabel} />
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: 14,
        padding: 16,
        gap: 12,
        marginBottom: 12,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={{ fontSize: 16, fontWeight: "700", color: palette.text }}
          >
            {title}
          </Text>
          <View
            style={{
              backgroundColor: palette.primarySoft,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: palette.primary,
              }}
            >
              {subtasks.length}
            </Text>
          </View>
        </View>

        {canAdd && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${title === "Child subtasks" ? "child subtask" : "subtask"}`}
            disabled={actionsPending}
            accessibilityState={{ disabled: actionsPending, busy: actionsPending }}
            onPress={onAddSubtask}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              minHeight: 36,
              paddingHorizontal: 8,
            }}
          >
            {actionsPending ? <BusyIndicator size={14} color={palette.primary} /> : <Plus size={15} color={palette.primary} />}
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: palette.primary,
              }}
            >
              Add
            </Text>
          </Pressable>
        )}
      </View>

      {subtasks.length > 0 ? (
        <View>
          {rows(subtasks.slice(0, 3))}
          {subtasks.length > 3 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`See all ${subtasks.length} subtasks`}
              onPress={() => setAllOpen(true)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                minHeight: 44,
                paddingTop: 10,
                paddingBottom: 2,
                borderTopWidth: 0.5,
                borderColor: palette.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: palette.primary,
                }}
              >
                See all {subtasks.length} subtasks
              </Text>
              <ChevronRight size={16} color={palette.primary} />
            </Pressable>
          )}
        </View>
      ) : (
        <Text
          style={{
            fontSize: 13,
            color: palette.mutedLabel,
            paddingVertical: 8,
          }}
        >
          {title === "Child subtasks"
            ? "No child subtasks yet."
            : "No subtasks yet."}
        </Text>
      )}
      {allOpen && (
        <Sheet open title={title} onClose={() => setAllOpen(false)}>
          {rows(subtasks)}
        </Sheet>
      )}
    </View>
  );
}

export function BentoSupportingGrid({
  onPressActivity,
  onPressReview,
  onPressFunding,
  onPressFiles,
}: {
  onPressActivity: () => void;
  onPressReview: () => void;
  onPressFunding: () => void;
  onPressFiles: () => void;
}) {
  const palette = useTheme();
  const { fontScale } = useWindowDimensions();

  const cardStyle = {
    flex: 1,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 14,
    minHeight: fontScale > 1.5 ? 104 : 92,
    justifyContent: "space-between" as const,
  };

  return (
    <View style={{ gap: 12, marginBottom: 16 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Activity, Updates & history"
          onPress={onPressActivity}
          style={cardStyle}
        >
          <Activity size={20} color={palette.text} />
          <View style={{ gap: 2, marginTop: 8 }}>
            <Text
              style={{ fontSize: 15, fontWeight: "700", color: palette.text }}
            >
              Activity
            </Text>
            <Text style={{ fontSize: 12, color: palette.mutedLabel }}>
              Updates & history
            </Text>
          </View>
          <ChevronRight
            size={14}
            color={palette.mutedLabel}
            style={{ alignSelf: "flex-end" }}
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Evidence & review, Submissions"
          onPress={onPressReview}
          style={cardStyle}
        >
          <ShieldCheck size={20} color={palette.text} />
          <View style={{ gap: 2, marginTop: 8 }}>
            <Text
              style={{ fontSize: 15, fontWeight: "700", color: palette.text }}
            >
              Evidence & review
            </Text>
            <Text style={{ fontSize: 12, color: palette.mutedLabel }}>
              Submissions
            </Text>
          </View>
          <ChevronRight
            size={14}
            color={palette.mutedLabel}
            style={{ alignSelf: "flex-end" }}
          />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Funding, Financial records"
          onPress={onPressFunding}
          style={cardStyle}
        >
          <Wallet size={20} color={palette.text} />
          <View style={{ gap: 2, marginTop: 8 }}>
            <Text
              style={{ fontSize: 15, fontWeight: "700", color: palette.text }}
            >
              Funding
            </Text>
            <Text style={{ fontSize: 12, color: palette.mutedLabel }}>
              Financial records
            </Text>
          </View>
          <ChevronRight
            size={14}
            color={palette.mutedLabel}
            style={{ alignSelf: "flex-end" }}
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Files, Attachments"
          onPress={onPressFiles}
          style={cardStyle}
        >
          <Files size={20} color={palette.text} />
          <View style={{ gap: 2, marginTop: 8 }}>
            <Text
              style={{ fontSize: 15, fontWeight: "700", color: palette.text }}
            >
              Files
            </Text>
            <Text style={{ fontSize: 12, color: palette.mutedLabel }}>
              Attachments
            </Text>
          </View>
          <ChevronRight
            size={14}
            color={palette.mutedLabel}
            style={{ alignSelf: "flex-end" }}
          />
        </Pressable>
      </View>
    </View>
  );
}

export function BentoSubtaskSupportingGrid({
  onPressActivity,
  onPressReview,
  onPressFunding,
  onPressFiles,
  onPressPlanning,
  showFunding = true,
}: {
  onPressActivity?: () => void;
  onPressReview: () => void;
  onPressFunding?: () => void;
  onPressFiles: () => void;
  onPressPlanning: () => void;
  showFunding?: boolean;
}) {
  const palette = useTheme();
  const { fontScale } = useWindowDimensions();

  const cardStyle = {
    flex: 1,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 14,
    minHeight: fontScale > 1.5 ? 104 : 92,
    justifyContent: "space-between" as const,
  };

  const renderTile = (
    icon: ReactNode,
    title: string,
    subtitle: string,
    onPress: () => void,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [cardStyle, pressed && { opacity: 0.78 }]}
    >
      {icon}
      <View style={{ gap: 2, marginTop: 8 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: palette.text }}>
          {title}
        </Text>
        <Text style={{ fontSize: 12, color: palette.mutedLabel }}>
          {subtitle}
        </Text>
      </View>
      <ChevronRight
        size={14}
        color={palette.mutedLabel}
        style={{ alignSelf: "flex-end" }}
      />
    </Pressable>
  );

  const hasFunding = showFunding && !!onPressFunding;
  const activityTile = onPressActivity
    ? renderTile(
        <Activity size={20} color={palette.text} />,
        "Activity",
        "Updates & history",
        onPressActivity,
      )
    : null;
  const reviewTile = renderTile(
    <ShieldCheck size={20} color={palette.text} />,
    "Evidence & review",
    "Submissions",
    onPressReview,
  );
  const fundingTile = hasFunding
    ? renderTile(
        <Wallet size={20} color={palette.text} />,
        "Funding",
        "Financial records",
        onPressFunding!,
      )
    : null;
  const filesTile = renderTile(
    <Files size={20} color={palette.text} />,
    "Files",
    "Attachments",
    onPressFiles,
  );
  const planningTile = renderTile(
    <ListCollapse size={20} color={palette.text} />,
    "Planning details",
    "Additional fields",
    onPressPlanning,
  );

  if (activityTile && hasFunding) {
    return (
      <View style={{ gap: 12, marginBottom: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Planning details, Additional fields"
          onPress={onPressPlanning}
          style={({ pressed }) => ({
            backgroundColor: palette.surface,
            borderWidth: 1,
            borderColor: palette.border,
            borderRadius: 14,
            padding: 14,
            minHeight: 56,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            opacity: pressed ? 0.78 : 1,
          })}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: palette.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ListCollapse size={18} color={palette.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: palette.text }}>
              Planning details
            </Text>
            <Text style={{ fontSize: 12, color: palette.mutedLabel }}>
              Additional fields
            </Text>
          </View>
          <ChevronRight size={16} color={palette.mutedLabel} />
        </Pressable>

        <View style={{ flexDirection: "row", gap: 12 }}>
          {activityTile}
          {reviewTile}
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          {fundingTile}
          {filesTile}
        </View>
      </View>
    );
  }

  if (activityTile) {
    return (
      <View style={{ gap: 12, marginBottom: 16 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {activityTile}
          {reviewTile}
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {filesTile}
          {planningTile}
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 12, marginBottom: 16 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {reviewTile}
        {fundingTile ?? filesTile}
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        {hasFunding ? filesTile : null}
        {planningTile}
      </View>
    </View>
  );
}

export function PlanningDetailsView({
  description,
  definitionOfDone,
  acceptanceCriteria,
}: {
  description?: string | null;
  definitionOfDone?: string | null;
  acceptanceCriteria?: readonly string[] | null;
}) {
  const palette = useTheme();

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: palette.mutedLabel,
            letterSpacing: 0.5,
          }}
        >
          DESCRIPTION
        </Text>
        <Text
          selectable
          style={{
            fontSize: 14,
            color: description ? palette.text : palette.mutedLabel,
            lineHeight: 20,
          }}
        >
          {description || "No description provided."}
        </Text>
      </View>

      <View style={{ gap: 6 }}>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: palette.mutedLabel,
            letterSpacing: 0.5,
          }}
        >
          DEFINITION OF DONE
        </Text>
        <Text
          selectable
          style={{
            fontSize: 14,
            color: definitionOfDone ? palette.text : palette.mutedLabel,
            lineHeight: 20,
          }}
        >
          {definitionOfDone || "No definition of done specified."}
        </Text>
      </View>

      {!!acceptanceCriteria?.length && (
        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: palette.mutedLabel,
              letterSpacing: 0.5,
            }}
          >
            ACCEPTANCE CRITERIA
          </Text>
          {acceptanceCriteria.map((criterion, idx) => (
            <Text
              key={idx}
              selectable
              style={{ fontSize: 14, color: palette.text, lineHeight: 20 }}
            >
              • {criterion}
            </Text>
          ))}
        </View>
      )}

      <View
        style={{
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.border,
          borderRadius: 10,
          padding: 12,
          marginTop: 4,
        }}
      >
        <Text
          style={{ fontSize: 12, color: palette.mutedLabel, lineHeight: 18 }}
        >
          Advanced planning, custom fields, dependencies, and branch
          configuration are managed on eFlow Web.
        </Text>
      </View>
    </View>
  );
}

export function PlanningDetailsSheet({
  open,
  onClose,
  description,
  definitionOfDone,
  acceptanceCriteria,
}: {
  open: boolean;
  onClose: () => void;
  description?: string | null;
  definitionOfDone?: string | null;
  acceptanceCriteria?: readonly string[] | null;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Planning details"
      description="Additional scope, criteria, and web configuration"
    >
      <ScrollView
        style={{ maxHeight: 420 }}
        contentContainerStyle={{ paddingVertical: 12 }}
      >
        <PlanningDetailsView
          description={description}
          definitionOfDone={definitionOfDone}
          acceptanceCriteria={acceptanceCriteria}
        />
      </ScrollView>
    </Sheet>
  );
}
