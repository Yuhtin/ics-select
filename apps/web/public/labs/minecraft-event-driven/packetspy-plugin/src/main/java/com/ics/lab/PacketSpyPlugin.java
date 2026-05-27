package com.ics.lab;

import io.papermc.paper.event.player.AsyncChatEvent;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.Location;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.player.PlayerDropItemEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.stream.Collectors;

/**
 * PacketSpyPlugin — observatório dos "packets" via Bukkit events.
 *
 * Nota didática: este plugin NÃO intercepta os bytes brutos do Netty.
 * Ele usa eventos do Bukkit como PROXIES dos packets equivalentes do
 * protocolo Minecraft. Cada PlayerMoveEvent corresponde a um packet
 * de posição/look serverbound; cada AsyncChatEvent a um Chat Message;
 * cada BlockBreakEvent a um Player Action (Start/Finish Digging).
 *
 * Pra interceptar os bytes literais você usaria ProtocolLib, PacketEvents
 * ou injeção direta de ChannelDuplexHandler no pipeline Netty. Pra fins
 * pedagógicos, os eventos do Bukkit são suficientes — eles disparam
 * exatamente quando esses packets são processados pelo servidor.
 *
 * Comandos:
 *   /readpacket &lt;TYPE&gt;   contagem nos últimos 60s + último valor
 *   /resumepackets         resumo (top → flop) dos tipos observados
 */
public class PacketSpyPlugin extends JavaPlugin implements Listener {

    private static final long WINDOW_MS = 60_000L;

    /** Timestamps (ms) dos últimos eventos por tipo. Pruned na escrita. */
    private final Map<String, Deque<Long>> timestamps = new ConcurrentHashMap<>();

    /** Última representação textual de cada tipo, pra /readpacket mostrar payload. */
    private final Map<String, String> lastValues = new ConcurrentHashMap<>();

    @Override
    public void onEnable() {
        getServer().getPluginManager().registerEvents(this, this);
        getLogger().info("PacketSpy enabled. /readpacket <type>, /resumepackets");
    }

    private void record(String type, String value) {
        long now = System.currentTimeMillis();
        Deque<Long> q = timestamps.computeIfAbsent(type, k -> new ConcurrentLinkedDeque<>());
        q.addLast(now);
        // expira entradas fora da janela de 60s
        while (!q.isEmpty() && q.peekFirst() < now - WINDOW_MS) {
            q.pollFirst();
        }
        lastValues.put(type, value);
    }

    private int countInWindow(String type) {
        Deque<Long> q = timestamps.get(type);
        if (q == null) return 0;
        long cutoff = System.currentTimeMillis() - WINDOW_MS;
        // limpa expirados antes de contar
        while (!q.isEmpty() && q.peekFirst() < cutoff) {
            q.pollFirst();
        }
        return q.size();
    }

    // ──────────────────────────────────────────────────────────────────
    // Listeners — cada um corresponde a um tipo de packet do protocolo
    // ──────────────────────────────────────────────────────────────────

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onMove(PlayerMoveEvent e) {
        Location from = e.getFrom();
        Location to = e.getTo();
        boolean moved = from.getX() != to.getX() || from.getY() != to.getY() || from.getZ() != to.getZ();
        boolean looked = from.getYaw() != to.getYaw() || from.getPitch() != to.getPitch();

        String type;
        if (moved && looked) type = "PLAYER_POSITION_AND_LOOK";
        else if (moved)      type = "PLAYER_POSITION";
        else if (looked)     type = "PLAYER_LOOK";
        else                 return; // nada relevante

        record(type, String.format(
            "%s @ x=%.1f y=%.1f z=%.1f yaw=%.0f",
            e.getPlayer().getName(),
            to.getX(), to.getY(), to.getZ(), to.getYaw()
        ));
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onChat(AsyncChatEvent e) {
        String msg = PlainTextComponentSerializer.plainText().serialize(e.message());
        record("CHAT_MESSAGE", e.getPlayer().getName() + ": \"" + msg + "\"");
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent e) {
        record("PLAYER_ACTION_DIG", e.getPlayer().getName() + " quebrou " + e.getBlock().getType().name());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPlace(BlockPlaceEvent e) {
        record("USE_ITEM_ON_BLOCK", e.getPlayer().getName() + " colocou " + e.getBlock().getType().name());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onInteract(PlayerInteractEvent e) {
        String action = e.getAction().name();
        record("USE_ITEM", e.getPlayer().getName() + " · " + action);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent e) {
        record("LOGIN_START", e.getPlayer().getName() + " entrou (uuid=" + e.getPlayer().getUniqueId() + ")");
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent e) {
        record("DISCONNECT", e.getPlayer().getName() + " saiu");
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onDamage(EntityDamageEvent e) {
        if (!(e.getEntity() instanceof Player p)) return;
        record("ENTITY_DAMAGE", String.format("%s tomou %.1f de dano (%s)",
            p.getName(), e.getDamage(), e.getCause().name()));
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onDrop(PlayerDropItemEvent e) {
        record("PLAYER_DROP_ITEM",
            e.getPlayer().getName() + " dropou " + e.getItemDrop().getItemStack().getType().name());
    }

    // ──────────────────────────────────────────────────────────────────
    // Comandos
    // ──────────────────────────────────────────────────────────────────

    @Override
    public boolean onCommand(CommandSender s, Command cmd, String label, String[] args) {
        return switch (cmd.getName().toLowerCase()) {
            case "readpacket"    -> cmdReadPacket(s, args);
            case "resumepackets" -> cmdResumePackets(s);
            default              -> false;
        };
    }

    private boolean cmdReadPacket(CommandSender s, String[] args) {
        if (args.length == 0) {
            s.sendMessage("§cUse: §7/readpacket <TYPE>");
            s.sendMessage("§7Exemplos: PLAYER_POSITION, CHAT_MESSAGE, PLAYER_ACTION_DIG, USE_ITEM, LOGIN_START");
            s.sendMessage("§7Ou rode §a/resumepackets §7pra ver todos os tipos observados.");
            return true;
        }
        String type = args[0].toUpperCase();
        int count = countInWindow(type);
        String last = lastValues.getOrDefault(type, "§8(nunca observado)");

        s.sendMessage("§a§l[PacketSpy] §r§7type=§f" + type);
        s.sendMessage("§7  Últimos 60s: §f" + count + (count == 0 ? " §8(zero)" : ""));
        s.sendMessage("§7  Última ocorrência: §f" + last);
        return true;
    }

    private boolean cmdResumePackets(CommandSender s) {
        long now = System.currentTimeMillis();
        long cutoff = now - WINDOW_MS;

        // monta a tabela de (tipo, contagem) ordenada decrescente
        List<Map.Entry<String, Integer>> rows = new ArrayList<>();
        for (Map.Entry<String, Deque<Long>> e : timestamps.entrySet()) {
            Deque<Long> q = e.getValue();
            while (!q.isEmpty() && q.peekFirst() < cutoff) {
                q.pollFirst();
            }
            if (!q.isEmpty()) {
                rows.add(Map.entry(e.getKey(), q.size()));
            }
        }
        rows.sort(Comparator.<Map.Entry<String, Integer>, Integer>comparing(Map.Entry::getValue).reversed());

        s.sendMessage("§a§l[PacketSpy] §r§7Resumo dos últimos 60s:");
        if (rows.isEmpty()) {
            s.sendMessage("§8  (nenhum packet observado ainda — peça pra alguém se mexer)");
            return true;
        }

        int total = rows.stream().mapToInt(Map.Entry::getValue).sum();
        for (Map.Entry<String, Integer> row : rows) {
            int c = row.getValue();
            int pct = (int) Math.round(100.0 * c / total);
            String bar = barOf(c, rows.get(0).getValue());
            s.sendMessage(String.format("§7  %-25s §f×%-5d §8%s §7%d%%", row.getKey(), c, bar, pct));
        }
        s.sendMessage("§8  ──────────────────────");
        s.sendMessage(String.format("§7  %-25s §f×%-5d", "TOTAL", total));
        return true;
    }

    private static String barOf(int v, int max) {
        if (max == 0) return "";
        int n = (int) Math.round(10.0 * v / max);
        return "█".repeat(n) + "░".repeat(Math.max(0, 10 - n));
    }
}
