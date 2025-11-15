import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  description?: string;
  initiallyOpen?: boolean;
  borderColor: string;
  backgroundColor: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  description,
  initiallyOpen = false,
  borderColor,
  backgroundColor,
}) => {
  const [isOpen, setIsOpen] = useState(initiallyOpen);

  return (
    <View style={[styles.sectionContainer, { borderColor, backgroundColor }]}> 
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setIsOpen(prev => !prev)}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: isOpen }}
      >
        <View style={styles.sectionHeaderTextContainer}>
          <ThemedText style={styles.sectionHeaderTitle}>{title}</ThemedText>
          {description ? (
            <ThemedText style={styles.sectionHeaderDescription}>{description}</ThemedText>
          ) : null}
        </View>
        <ThemedText style={styles.sectionHeaderIndicator}>{isOpen ? '▾' : '▸'}</ThemedText>
      </TouchableOpacity>
      {isOpen ? <View style={styles.sectionContent}>{children}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionHeaderDescription: {
    fontSize: 13,
    marginTop: 4,
    opacity: 0.7,
  },
  sectionHeaderIndicator: {
    fontSize: 20,
    marginLeft: 12,
  },
  sectionContent: {
    marginTop: 16,
  },
});

export default CollapsibleSection;
