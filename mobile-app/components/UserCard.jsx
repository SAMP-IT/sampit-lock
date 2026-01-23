// components/UserCard.js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../constants/Colors";
import Theme from "../constants/Theme";
import AppCard from "./ui/AppCard";

const UserCard = ({ user, onViewHistory, onEditAccess, onRemoveUser, canEdit, showActions }) => {
  // Accept but don't pass extra props to AppCard to prevent type errors
  return (
    <AppCard variant="tinted">
      {/* ---------- Header Section ---------- */}
      <View style={styles.header}>
        {/* User Info (Avatar + Name + Role) */}
        <View style={styles.userInfo}>
          {/* Avatar with initials */}
          <View style={styles.avatar}>
            <Text style={styles.initials}>{user.initials}</Text>
          </View>

          {/* Name & Role */}
          <View style={styles.nameSection}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{user.name}</Text>
            </View>

            {/* Role Badge */}
            <View style={styles.badge}>
              <Text style={styles.role}>
                {user.role === "Admin" ? "You" : user.role}
              </Text>
              {user.role === "Admin" && (
                <Text style={styles.adminText}>Admin</Text>
              )}
            </View>
          </View>
        </View>

        {/* Status Badge (Active / Inactive) */}
        <View style={styles.statusBadge}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: user.status === "Active" ? Colors.green : Colors.red },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: user.status === "Active" ? Colors.green : Colors.red },
            ]}
          >
            {user.status}
          </Text>
        </View>
      </View>

      {/* ---------- Access Methods Section ---------- */}
      <View style={styles.accessMethods}>
        <Text style={styles.accessTitle}>Access methods</Text>
        <View style={styles.methodsRow}>
          {Array.isArray(user.accessMethods) && user.accessMethods.map((method, index) => (
            <View key={index} style={styles.methodBadge}>
              <Ionicons name={method.type} size={18} color={Colors.iconbackground} />
              <Text style={styles.methodCount}>{method.count}</Text>
            </View>
          ))}
          {(!user.accessMethods || user.accessMethods.length === 0) && (
            <Text style={styles.noMethodsText}>No access methods</Text>
          )}
        </View>
      </View>

      {/* ---------- Action Buttons ---------- */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.viewHistoryButton}
          onPress={onViewHistory}
        >
          <Text style={styles.viewHistoryText}>View History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.editAccessButton}
          onPress={onEditAccess}
        >
          <Text style={styles.editAccessText}>Edit Access</Text>
        </TouchableOpacity>
      </View>
    </AppCard>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Theme.spacing.lg,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    backgroundColor: Colors.iconbackground,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Theme.spacing.md,
  },
  initials: {
    color: Colors.textwhite,
    fontSize: 18,
    fontWeight: "bold",
  },
  nameSection: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  name: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.titlecolor,
    marginRight: Theme.spacing.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
  },
  role: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  adminText: {
    color: Colors.endboxText,
    fontSize: 12,
    fontWeight: "500",
    marginLeft: Theme.spacing.sm,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.backgroundwhite,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: Theme.radius.pill,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  accessMethods: {
    marginBottom: Theme.spacing.lg,
  },
  accessTitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginBottom: Theme.spacing.sm,
  },
  methodsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  methodBadge: {
    backgroundColor: Colors.backgroundwhite,
    borderWidth: 1,
    borderColor: Colors.iconbackground,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 8,
    borderRadius: Theme.radius.pill,
    marginRight: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  methodCount: {
    color: Colors.iconbackground,
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 4,
  },
  noMethodsText: {
    color: Colors.subtitlecolor,
    fontSize: 14,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: "row",
  },
  viewHistoryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.pill,
    alignItems: "center",
    marginRight: Theme.spacing.sm,
  },
  viewHistoryText: {
    color: Colors.iconbackground,
    fontSize: 16,
    fontWeight: "500",
  },
  editAccessButton: {
    flex: 1,
    backgroundColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.pill,
    alignItems: "center",
  },
  editAccessText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: "500",
  },
});

export default UserCard;
