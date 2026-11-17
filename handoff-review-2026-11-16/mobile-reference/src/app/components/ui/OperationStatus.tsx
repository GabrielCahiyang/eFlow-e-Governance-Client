import { useSyncExternalStore } from "react";
import { View } from "react-native";
import { Text } from "./Typography";
import { BusyIndicator } from "./BusyIndicator";
import { useTheme } from "./Appearance";
import {
  operationMessage,
  subscribeOperationActivity,
} from "../../shared/operationActivity";

export function SmallProgress({ label }: { label: string }) {
  const palette = useTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 4,
        flexShrink: 1,
      }}
    >
      <BusyIndicator size={14} color={palette.primary} />
      <Text style={{ fontSize: 12, color: palette.mutedLabel, flexShrink: 1 }}>
        {label}
      </Text>
    </View>
  );
}

export function OperationStatus() {
  const label = useSyncExternalStore(
    subscribeOperationActivity,
    operationMessage,
    operationMessage,
  );
  return label ? <SmallProgress label={label} /> : null;
}
