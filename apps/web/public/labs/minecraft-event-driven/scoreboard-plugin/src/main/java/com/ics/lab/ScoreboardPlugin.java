package com.ics.lab;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitRunnable;
import org.bukkit.scoreboard.DisplaySlot;
import org.bukkit.scoreboard.Objective;
import org.bukkit.scoreboard.Scoreboard;
import org.bukkit.scoreboard.Team;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * ScoreboardPlugin · estilo FeatherBoard
 *
 * Pattern de otimização:
 *   • Cada linha do scoreboard tem um "entry" único (token invisível
 *     usando códigos de cor: §0§r, §1§r, ...). O entry NUNCA muda.
 *   • O texto visível é o PREFIX de um Team que possui esse entry.
 *   • Atualizar texto = trocar prefix do Team = 1 packet por linha
 *     que mudou. Comparado com o padrão naïve que apaga e re-cria a
 *     Score (2 packets) e força full re-render no client, isso é
 *     ~10× mais barato pra updates frequentes.
 *
 * Update strategy:
 *   • Linhas estáticas (nick, título, URL) → set 1× no PlayerJoinEvent.
 *   • Online count → atualizado por evento (Join/Quit), zero polling.
 *   • TPS → 1 update por segundo (20 ticks), usando sampler próprio
 *     de 200 ticks (= janela de 10s, "TPS atual" não "TPS 1min").
 *
 * Layout (top → bottom · sem dividers, espaços vazios entre seções):
 *   Title:  §4§lICS §c§lTECH
 *   1       (linha vazia)
 *   2       §fNick: §e<player>
 *   3       §fOnline: §e<n>§7/§e<max>
 *   4       (linha vazia)
 *   5       §fTPS: §e<tps>          (cor: verde ≥19 · amarelo ≥15 · vermelho)
 *   6       (linha vazia)
 *   7       §cics.daviduarte.com.br
 */
public class ScoreboardPlugin extends JavaPlugin implements Listener {

    // Score = posição vertical no scoreboard (maior = mais acima)
    private static final int LINE_BLANK_TOP = 8;
    private static final int LINE_NICK      = 7;
    private static final int LINE_ONLINE    = 6;
    private static final int LINE_BLANK_MID = 5;
    private static final int LINE_TPS       = 4;
    private static final int LINE_BLANK_BOT = 3;
    private static final int LINE_URL       = 2;

    // Entries invisíveis (tokens únicos por linha)
    private static final String E_BLANK_TOP = "§0§r";
    private static final String E_NICK      = "§1§r";
    private static final String E_ONLINE    = "§2§r";
    private static final String E_BLANK_MID = "§3§r";
    private static final String E_TPS       = "§4§r";
    private static final String E_BLANK_BOT = "§5§r";
    private static final String E_URL       = "§6§r";

    private static final Component BLANK = Component.empty();

    private final Map<UUID, PlayerBoard> boards = new ConcurrentHashMap<>();
    private final TpsSampler tps = new TpsSampler();

    @Override
    public void onEnable() {
        getServer().getPluginManager().registerEvents(this, this);

        // Sampler: roda EM TODO tick pra coletar timestamps
        new BukkitRunnable() {
            @Override public void run() { tps.record(); }
        }.runTaskTimer(this, 1L, 1L);

        // Update de TPS — 1× por segundo (1 packet por player online)
        new BukkitRunnable() {
            @Override public void run() { updateTpsForAll(); }
        }.runTaskTimer(this, 20L, 20L);

        // Caso o plugin recarregue com players já online
        for (Player p : Bukkit.getOnlinePlayers()) attach(p);

        getLogger().info("Scoreboard plugin enabled (FeatherBoard-style · Team.prefix updates)");
    }

    @Override
    public void onDisable() {
        for (Player p : Bukkit.getOnlinePlayers()) {
            p.setScoreboard(Bukkit.getScoreboardManager().getMainScoreboard());
        }
        boards.clear();
    }

    // ──────────────────────────────────────────────────────────────────
    // Lifecycle
    // ──────────────────────────────────────────────────────────────────

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent e) {
        Player p = e.getPlayer();
        getLogger().info("[Scoreboard] " + p.getName() + " entrou. Anexando scoreboard.");
        // Pequeno delay pra rodar DEPOIS da PinPlugin (que pode trocar gamemode/loc)
        Bukkit.getScheduler().runTaskLater(this, () -> {
            if (p.isOnline()) attach(p);
        }, 5L);
        // Atualiza online count nos OUTROS players (esse acabou de entrar)
        Bukkit.getScheduler().runTaskLater(this, this::updateOnlineForAll, 10L);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent e) {
        boards.remove(e.getPlayer().getUniqueId());
        // PlayerQuitEvent dispara ANTES do player sair da lista, então
        // agenda o refresh do online count pro próximo tick
        Bukkit.getScheduler().runTaskLater(this, this::updateOnlineForAll, 1L);
    }

    // ──────────────────────────────────────────────────────────────────
    // Setup do scoreboard (1× por player)
    // ──────────────────────────────────────────────────────────────────

    private void attach(Player p) {
        UUID id = p.getUniqueId();
        Scoreboard sb = Bukkit.getScoreboardManager().getNewScoreboard();

        Component title = Component.text()
            .append(Component.text("ICS", NamedTextColor.DARK_RED, TextDecoration.BOLD))
            .append(Component.text(" TECH", NamedTextColor.RED, TextDecoration.BOLD))
            .build();

        Objective obj = sb.registerNewObjective("ics", "dummy", title);
        obj.setDisplaySlot(DisplaySlot.SIDEBAR);

        PlayerBoard pb = new PlayerBoard(sb, obj);

        // Cria as 7 linhas. Score = posição vertical.
        pb.line(E_BLANK_TOP, LINE_BLANK_TOP, "blank1", BLANK);
        pb.line(E_NICK,      LINE_NICK,      "nick",   nickLine(p.getName()));
        pb.line(E_ONLINE,    LINE_ONLINE,    "online", onlineLine(Bukkit.getOnlinePlayers().size()));
        pb.line(E_BLANK_MID, LINE_BLANK_MID, "blank2", BLANK);
        pb.line(E_TPS,       LINE_TPS,       "tps",    tpsLine(tps.tps10s()));
        pb.line(E_BLANK_BOT, LINE_BLANK_BOT, "blank3", BLANK);
        pb.line(E_URL,       LINE_URL,       "url",    urlLine());

        p.setScoreboard(sb);
        boards.put(id, pb);

        getLogger().info("[Scoreboard] " + p.getName() + " · scoreboard attached · "
            + obj.getScoreboard().getEntries().size() + " entries · "
            + sb.getTeams().size() + " teams");
    }

    // ──────────────────────────────────────────────────────────────────
    // Updates (Team.prefix · 1 packet por linha por player)
    // ──────────────────────────────────────────────────────────────────

    private void updateOnlineForAll() {
        Component line = onlineLine(Bukkit.getOnlinePlayers().size());
        for (PlayerBoard pb : boards.values()) {
            pb.updatePrefix("online", line);
        }
    }

    private void updateTpsForAll() {
        Component line = tpsLine(tps.tps10s());
        for (PlayerBoard pb : boards.values()) {
            pb.updatePrefix("tps", line);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Linhas
    // ──────────────────────────────────────────────────────────────────

    private static Component nickLine(String name) {
        return Component.text()
            .append(Component.text("Nick: ", NamedTextColor.WHITE))
            .append(Component.text(name, NamedTextColor.YELLOW))
            .build();
    }

    private static Component onlineLine(int n) {
        int max = Bukkit.getServer().getMaxPlayers();
        return Component.text()
            .append(Component.text("Online: ", NamedTextColor.WHITE))
            .append(Component.text(n, NamedTextColor.YELLOW))
            .append(Component.text("/", NamedTextColor.GRAY))
            .append(Component.text(max, NamedTextColor.YELLOW))
            .build();
    }

    private static Component tpsLine(double t) {
        TextColor color = t >= 19.0 ? NamedTextColor.GREEN
                        : t >= 15.0 ? NamedTextColor.YELLOW
                        : NamedTextColor.RED;
        String label = String.format("%.2f", Math.min(20.0, t));
        return Component.text()
            .append(Component.text("TPS: ", NamedTextColor.WHITE))
            .append(Component.text(label, color, TextDecoration.BOLD))
            .build();
    }

    private static Component urlLine() {
        return Component.text("ics.daviduarte.com.br", NamedTextColor.RED);
    }

    // ──────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────

    private static class PlayerBoard {
        final Scoreboard sb;
        final Objective obj;
        final Map<String, Team> teams = new HashMap<>();

        PlayerBoard(Scoreboard sb, Objective obj) {
            this.sb = sb;
            this.obj = obj;
        }

        /** Cria uma linha: Team com entry único + prefix visível + score posicional. */
        void line(String entry, int score, String key, Component prefix) {
            Team t = sb.registerNewTeam("ln_" + key);
            t.addEntry(entry);
            t.prefix(prefix);
            obj.getScore(entry).setScore(score);
            teams.put(key, t);
        }

        /** Atualiza apenas o prefix · 1 packet. */
        void updatePrefix(String key, Component prefix) {
            Team t = teams.get(key);
            if (t != null) t.prefix(prefix);
        }
    }

    /**
     * Sampler próprio de tick times — ring buffer de 200 timestamps
     * (≈ 10s @ 20 TPS). TPS computado por elapsed time real.
     *
     * Por que não Bukkit.getServer().getTPS()?
     *   Retorna [1m, 5m, 15m] — janelas longas demais pra mostrar TPS
     *   "agora" durante demos ao vivo. 10s é o sweet spot.
     */
    private static class TpsSampler {
        private static final int SAMPLES = 200;
        private final long[] stamps = new long[SAMPLES];
        private int idx = 0;
        private int filled = 0;

        synchronized void record() {
            stamps[idx] = System.nanoTime();
            idx = (idx + 1) % SAMPLES;
            if (filled < SAMPLES) filled++;
        }

        synchronized double tps10s() {
            if (filled < 2) return 20.0;
            int oldestIdx = (idx - filled + SAMPLES) % SAMPLES;
            int newestIdx = (idx - 1 + SAMPLES) % SAMPLES;
            long elapsedNs = stamps[newestIdx] - stamps[oldestIdx];
            if (elapsedNs <= 0) return 20.0;
            double seconds = elapsedNs / 1_000_000_000.0;
            return Math.min(20.0, (filled - 1) / seconds);
        }
    }
}
