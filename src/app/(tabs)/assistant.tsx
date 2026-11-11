import { useRef, useState, type ComponentRef } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/LogoMark';
import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/Buttons';
import { DemoNotice } from '@/components/ui/DemoNotice';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import {
  demoReply,
  INITIAL_CONVERSATION,
  RECOMMENDATIONS,
  SUGGESTED_QUESTIONS,
  type AdvisorMessage,
} from '@/features/advisor/demoReplies';
import { haptics } from '@/lib/haptics';
import { palette, resolveTone, screenPadding, useAppTheme } from '@/theme';

export default function AssistantScreen() {
  const { colors, spacing, typography, radius, scheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [messages, setMessages] = useState<AdvisorMessage[]>(INITIAL_CONVERSATION);
  const [draft, setDraft] = useState('');

  const ask = (question: string) => {
    const text = question.trim();
    if (!text) return;
    haptics.light();
    setMessages((current) => [
      ...current,
      { id: `u-${current.length}`, role: 'user', text },
      { id: `a-${current.length + 1}`, role: 'assistant', text: demoReply(text), example: true },
    ]);
    setDraft('');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, paddingHorizontal: screenPadding }]}>
        <View style={[styles.avatar, { backgroundColor: palette.forest }]}>
          <LogoMark size={26} />
        </View>
        <View style={styles.flex}>
          <AppText variant="title" accessibilityRole="header">
            Asesor LUJITOS
          </AppText>
          <View style={styles.status}>
            <View style={[styles.statusDot, { backgroundColor: colors.textTertiary }]} />
            <AppText variant="footnote" color="textSecondary">
              Vista previa · sin conexión a IA
            </AppText>
          </View>
        </View>
        <IconButton
          icon="info.circle"
          accessibilityLabel="Cómo funcionará el asesor"
          onPress={() =>
            Alert.alert(
              'Cómo funcionará el asesor',
              'En la Fase 9 se conectará a Claude. Solo enviará los datos mínimos necesarios y únicamente si das tu permiso. Nunca inventará saldos ni movimientos.',
            )
          }
        />
      </View>

      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={{ paddingHorizontal: screenPadding, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.md }}
        >
          <DemoNotice text="El asesor todavía no está conectado a la IA ni a tus datos reales. Las respuestas son ejemplos fijos." />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -screenPadding }}
            contentContainerStyle={{ gap: spacing.md, paddingHorizontal: screenPadding }}
          >
            {RECOMMENDATIONS.map((item) => {
              const tone = resolveTone(item.tone, scheme);
              return (
                <FinancialCard
                  key={item.id}
                  onPress={() => ask(item.question)}
                  accessibilityLabel={`${item.title}. ${item.body}. Preguntar al asesor`}
                  style={styles.recommendation}
                  padding={spacing.md + 2}
                >
                  <View style={[styles.recIcon, { backgroundColor: tone.soft }]}>
                    <Icon name={item.icon} size={15} color={tone.ink} />
                  </View>
                  <AppText variant="subhead" numberOfLines={2} style={{ marginTop: spacing.sm }}>
                    {item.title}
                  </AppText>
                  <AppText variant="footnote" color="textSecondary" numberOfLines={2}>
                    {item.body}
                  </AppText>
                </FinancialCard>
              );
            })}
          </ScrollView>

          {messages.map((message) => (
            <Animated.View
              key={message.id}
              entering={FadeInUp.duration(260)}
              style={[styles.bubbleRow, message.role === 'user' ? styles.alignEnd : styles.alignStart]}
            >
              <View
                style={[
                  styles.bubble,
                  { borderRadius: radius.lg, borderCurve: 'continuous' },
                  message.role === 'user'
                    ? { backgroundColor: colors.primary, borderBottomRightRadius: 6 }
                    : {
                        backgroundColor: colors.surface,
                        borderBottomLeftRadius: 6,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.border,
                      },
                ]}
              >
                <AppText variant="callout" color={message.role === 'user' ? 'onPrimary' : 'text'}>
                  {message.text}
                </AppText>
                {message.example ? (
                  <AppText variant="caption" color="textTertiary" style={{ marginTop: spacing.xs }}>
                    Respuesta de ejemplo · datos de demostración
                  </AppText>
                ) : null}
              </View>
            </Animated.View>
          ))}
        </ScrollView>

        <View style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: screenPadding }}
          >
            {SUGGESTED_QUESTIONS.map((question) => (
              <Pressable
                key={question}
                accessibilityRole="button"
                accessibilityLabel={`Preguntar: ${question}`}
                onPress={() => ask(question)}
                style={({ pressed }) => [
                  styles.suggestion,
                  { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.md },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <AppText variant="subhead" numberOfLines={1}>
                  {question}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
          <View style={[styles.inputRow, { paddingHorizontal: screenPadding }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Escribe tu pregunta"
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.primary}
              multiline
              maxLength={300}
              accessibilityLabel="Pregunta para el asesor"
              style={[
                typography.body,
                styles.input,
                { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
              ]}
            />
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Enviar pregunta"
              accessibilityState={{ disabled: draft.trim().length === 0 }}
              disabled={draft.trim().length === 0}
              scaleTo={0.9}
              onPress={() => ask(draft)}
              style={[styles.send, { backgroundColor: colors.primary }]}
            >
              <Icon name="arrow.up" size={18} color={colors.onPrimary} weight="bold" />
            </PressableScale>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  recommendation: { width: 168 },
  recIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  bubbleRow: { flexDirection: 'row' },
  alignEnd: { justifyContent: 'flex-end' },
  alignStart: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '86%', paddingHorizontal: 14, paddingVertical: 10 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingBottom: 10, gap: 10 },
  suggestion: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    borderWidth: StyleSheet.hairlineWidth,
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
