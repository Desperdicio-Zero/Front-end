/**
 * src/components/SwipeableCard.tsx
 * =================================
 * Wrapper que adiciona swipe-to-reveal sobre qualquer conteúdo.
 * Implementado com Animated + PanResponder (zero dependências externas).
 *
 * Abordagem: Row layout completo
 * ────────────────────────────────
 * O wrapper tem `overflow: hidden` e largura = SCREEN_WIDTH.
 * O row interno tem 3 filhos lado a lado:
 *   [ Edit (SLOT_W) | Card (SCREEN_W) | Delete (SLOT_W) ]
 * O row inicia translateX = -SLOT_W (card visível, ações ocultas).
 * Swipe right → translateX = 0          (Edit visível)
 * Swipe left  → translateX = -2 * SLOT_W (Delete visível)
 *
 * Os botões ficam dentro do Animated.View portanto se movem com o card,
 * mas o PanResponder está apenas no slot do card — sem conflict com toque.
 */

import React, { useRef } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Edit3, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SLOT_W       = 88;
const SWIPE_THRESH = 40;
const NEUTRAL      = -SLOT_W;
const EDIT_OPEN    = 0;
const DELETE_OPEN  = -(SLOT_W * 2);

interface SwipeableCardProps {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}

const SwipeableCard: React.FC<SwipeableCardProps> = ({ children, onEdit, onDelete }) => {
  const panX   = useRef(new Animated.Value(NEUTRAL)).current;
  const startX = useRef(NEUTRAL);

  const snapTo = (toValue: number) => {
    startX.current = toValue;
    // Haptic leve ao abrir um painel
    if (toValue !== NEUTRAL) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    Animated.spring(panX, {
      toValue,
      useNativeDriver: true,
      bounciness: 3,
      speed: 16,
    }).start();
  };

  const close = () => snapTo(NEUTRAL);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) * 1.5 && Math.abs(g.dx) > 8,

      onPanResponderGrant: () => {
        startX.current = NEUTRAL;
        panX.setValue(NEUTRAL);
      },

      onPanResponderMove: (_, g) => {
        const next = Math.max(DELETE_OPEN, Math.min(EDIT_OPEN, startX.current + g.dx));
        panX.setValue(next);
      },

      onPanResponderRelease: (_, g) => {
        if      (g.dx >  SWIPE_THRESH) snapTo(EDIT_OPEN);
        else if (g.dx < -SWIPE_THRESH) snapTo(DELETE_OPEN);
        else                           close();
      },

      onPanResponderTerminate: () => close(),
    }),
  ).current;

  return (
    <View style={s.wrapper}>
      <Animated.View style={[s.row, { transform: [{ translateX: panX }] }]}>

        {/* ── Left action: Editar ───────────────────────────── */}
        <TouchableOpacity
          style={[s.action, s.leftAction]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            close();
            setTimeout(onEdit, 120);
          }}
          activeOpacity={0.8}
        >
          <Edit3 size={20} color="#FFF" strokeWidth={2.5} />
          <Text style={s.actionLabel}>Editar</Text>
        </TouchableOpacity>

        {/* ── Card (recebe panHandlers) ─────────────────────── */}
        <View style={s.cardSlot} {...panResponder.panHandlers}>
          {children}
        </View>

        {/* ── Right action: Remover ─────────────────────────── */}
        <TouchableOpacity
          style={[s.action, s.rightAction]}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            close();
            setTimeout(onDelete, 120);
          }}
          activeOpacity={0.8}
        >
          <Trash2 size={20} color="#FFF" strokeWidth={2.5} />
          <Text style={s.actionLabel}>Remover</Text>
        </TouchableOpacity>

      </Animated.View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    width: SCREEN_WIDTH,
  },
  row: {
    flexDirection: 'row',
    width: SCREEN_WIDTH + SLOT_W * 2,
  },
  cardSlot: {
    width: SCREEN_WIDTH,
  },
  action: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    marginBottom: 6,
  },
  leftAction: {
    width: SLOT_W - 16,
    marginLeft: 16,
    backgroundColor: '#2563EB',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  rightAction: {
    width: SLOT_W - 16,
    marginRight: 16,
    backgroundColor: '#DC2626',
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  actionLabel: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default SwipeableCard;
