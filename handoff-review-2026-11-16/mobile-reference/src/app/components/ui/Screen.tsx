import { Text } from "./Typography";
import type { ReactNode } from "react";
import {
  StyleSheet,
  type FlatListProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ScrollView, View } from "./Primitives";
import Animated from "react-native-reanimated";
import AlertCircle from "lucide-react-native/icons/circle-alert";
import ClockAlert from "lucide-react-native/icons/clock-alert";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import ShieldAlert from "lucide-react-native/icons/shield-alert";
import WifiOff from "lucide-react-native/icons/wifi-off";
import { EmptyIllustration, type EmptyKind } from "./EmptyIllustration";
import { colors, withOpacity } from "./theme";
import { Button } from "./Button";
import { OperationStatus } from "./OperationStatus";
import {
  ViewLoadingState,
  type LoadingLayout,
} from "./loading/ViewLoadingState";
import { useAppearance, useTheme } from "./Appearance";
import { usePullRefresh } from "../../shared/usePullRefresh";
import { FolderPullArea, RefreshFlatList } from "./FolderRefresh";
import {
  feedback,
  userErrorMessage,
  type FeedbackContext,
} from "../../shared/userMessages";

const RefreshScreenScroll = Animated.createAnimatedComponent(ScrollView);

export function Screen<T = never>({
  title,
  description,
  actions,
  children,
  onRefresh,
  style,
  compact = false,
  footer,
  list,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  onRefresh?: () => Promise<unknown>;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  footer?: ReactNode;
  list?: Pick<
    FlatListProps<T>,
    | "data"
    | "keyExtractor"
    | "renderItem"
    | "onEndReached"
    | "ListFooterComponent"
  >;
}) {
  const palette = useTheme();
  const pull = usePullRefresh(onRefresh);
  const ContentScroll = onRefresh ? RefreshScreenScroll : ScrollView;
  const scrollProps = {
    contentInsetAdjustmentBehavior: "automatic" as const,
    style: { flex: 1, backgroundColor: palette.background },
    keyboardShouldPersistTaps: "handled" as const,
    contentContainerStyle: [
      s.content,
      compact && s.compact,
      { backgroundColor: palette.background },
      style,
    ],
  };
  const header = (
    <>
      <OperationStatus />
      {!!title && (
        <View style={s.header}>
          <View style={s.heading}>
            <Text
              accessibilityRole="header"
              style={[s.title, compact && s.compactTitle]}
            >
              {title}
            </Text>
            {!!description && <Text style={s.description}>{description}</Text>}
          </View>
          {actions}
        </View>
      )}
      {!!pull.error && (
        <ErrorState error={pull.error} retry={() => void pull.refresh()} />
      )}
      {children}
    </>
  );
  const scroll = list ? (
    <RefreshFlatList
      {...scrollProps}
      {...list}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <View style={{ gap: compact ? 10 : 16 }}>{header}</View>
      }
    />
  ) : (
    <ContentScroll {...scrollProps}>{header}</ContentScroll>
  );
  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      {onRefresh ? (
        <FolderPullArea pull={pull}>{scroll}</FolderPullArea>
      ) : (
        scroll
      )}
      {footer}
    </View>
  );
}
export function Card({
  title,
  children,
  style,
}: {
  title?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.card, style]}>
      {!!title && (
        <Text accessibilityRole="header" style={s.cardTitle}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}
export function Loading({
  label = "Loading content",
  layout = "navigation",
  rows,
}: {
  label?: string;
  layout?: LoadingLayout;
  rows?: number;
}) {
  return <ViewLoadingState label={label} layout={layout} rows={rows} />;
}
function errorMeta(message: string, context: FeedbackContext) {
  if (/^Ask the appointed Task Lead\b/.test(message))
    return { title: "Schedule update needed", Icon: AlertCircle };
  if (message === feedback.invalidCredentials)
    return { title: "Couldn't sign in", Icon: ShieldAlert };
  if (/Connection unavailable/i.test(message))
    return { title: "Connection unavailable", Icon: WifiOff };
  if (/timed? out/i.test(message))
    return { title: "Request timed out", Icon: ClockAlert };
  if (message === feedback.session)
    return { title: "Session expired", Icon: ShieldAlert };
  if (
    /don't have access|permission|Web only|inactive|locked|no longer available/i.test(
      message,
    )
  )
    return { title: "Access notice", Icon: ShieldAlert };
  if (/already saved|changes were saved/i.test(message))
    return { title: "Changes saved", Icon: AlertCircle };
  if (/couldn't confirm/i.test(message))
    return { title: "Check before retrying", Icon: AlertCircle };
  if (/has changed/i.test(message))
    return { title: "Item updated", Icon: AlertCircle };
  if (/the upload stopped before/i.test(message))
    return { title: "Upload interrupted", Icon: AlertCircle };
  if (
    /^(?:Ask the appointed Task Lead|Enter|Choose|Record|Explain|Describe|Use|Passwords|Progress|Actual spending|Attach|Title|Task name|A work note|A review note|Needed-by|Allow camera)\b/i.test(
      message,
    )
  )
    return { title: "Check your details", Icon: AlertCircle };
  if (context === "action")
    return { title: "Couldn't complete this", Icon: AlertCircle };
  return { title: "Unable to load", Icon: AlertCircle };
}
export function ErrorState({
  error,
  retry,
  context = "load",
}: {
  error: unknown;
  retry?: () => void;
  context?: FeedbackContext;
}) {
  const palette = useTheme();
  const { isDark } = useAppearance();
  const message = userErrorMessage(error, context);
  const { title, Icon } = errorMeta(message, context);
  return (
    <View
      style={[
        s.error,
        {
          backgroundColor: isDark ? "#1d1a30" : "#fffafb",
          borderColor: withOpacity(palette.danger, isDark ? 0.32 : 0.2),
          borderLeftColor: palette.danger,
        },
      ]}
    >
      <View
        accessible={false}
        style={[
          s.errorBadge,
          {
            backgroundColor: palette.dangerSoft,
            borderColor: withOpacity(palette.danger, isDark ? 0.35 : 0.16),
          },
        ]}
      >
        <Icon size={18} color={palette.danger} />
      </View>
      <View style={s.errorBody}>
        <View accessible accessibilityRole="alert" style={s.errorCopy}>
          <Text style={[s.errorTitle, { color: palette.text }]}>{title}</Text>
          <Text style={[s.errorText, { color: palette.muted }]}>{message}</Text>
        </View>
        {!!retry && (
          <Button
            variant="outline"
            accessibilityLabel="Retry"
            onPress={retry}
            icon={<RotateCcw size={14} color={palette.text} />}
            style={[
              s.errorRetry,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
            textStyle={[s.errorRetryText, { color: palette.text }]}
          >
            Retry
          </Button>
        )}
      </View>
    </View>
  );
}
export function Empty({
  title = "Nothing here yet",
  description,
  action,
  compact = false,
  kind = "work",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  kind?: EmptyKind;
}) {
  const palette = useTheme();
  return (
    <View
      style={[
        compact ? s.compactEmpty : s.empty,
        { backgroundColor: "transparent" },
      ]}
    >
      <EmptyIllustration kind={kind} compact={compact} />
      <Text
        accessibilityRole="header"
        style={[
          s.cardTitle,
          {
            textAlign: "center",
            color: palette.text,
            fontSize: compact ? 16 : 20,
          },
        ]}
      >
        {title}
      </Text>
      {!!description && (
        <Text
          style={[
            s.description,
            { textAlign: "center", maxWidth: 340, color: palette.mutedLabel },
          ]}
        >
          {description}
        </Text>
      )}
      {action}
    </View>
  );
}
export function LabelValue({
  label,
  value,
  stacked = false,
}: {
  label: string;
  value: ReactNode;
  stacked?: boolean;
}) {
  return (
    <View style={stacked ? s.stackedValue : s.labelValue}>
      <Text style={[s.description, !stacked && { flexShrink: 1 }]}>
        {label}
      </Text>
      {typeof value === "string" || typeof value === "number" ? (
        <Text
          style={[
            s.value,
            stacked && { textAlign: "left", alignSelf: "stretch" },
          ]}
        >
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <View style={s.notice}>
      <Text style={s.description}>{children}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 36,
    flexGrow: 1,
    backgroundColor: colors.background,
  },
  header: {
    gap: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  compact: { gap: 10, paddingTop: 10, paddingBottom: 24 },
  compactTitle: { fontSize: 21, lineHeight: 28 },
  compactEmpty: { gap: 8, paddingVertical: 12, alignItems: "center" },
  heading: { flex: 1, minWidth: 190, gap: 6 },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "600",
    color: colors.text,
  },
  description: { fontSize: 13, lineHeight: 20, color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  empty: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    gap: 14,
    justifyContent: "center",
    alignItems: "center",
    flexGrow: 1,
  },
  error: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 14,
  },
  errorBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  errorBody: {
    flex: 1,
    gap: 3,
    alignItems: "flex-start",
  },
  errorCopy: {
    gap: 3,
    alignSelf: "stretch",
  },
  errorTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
  },
  errorRetry: {
    marginTop: 7,
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  errorRetryText: {
    fontSize: 13,
    fontWeight: "600",
  },
  labelValue: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  stackedValue: { gap: 2, alignItems: "flex-start" },
  value: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "500",
    flexShrink: 1,
    textAlign: "right",
  },
  notice: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    padding: 14,
  },
});
