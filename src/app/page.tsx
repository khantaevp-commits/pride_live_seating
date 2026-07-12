"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type SeatRow = {
  id: string;
  player_name: string;
  table_number: number;
  seat_number: number;
  created_at: string;
};

type TournamentSettings = {
  id: number;
  active_tables: number;
  player_limit: number;
};

function buildSeats(activeTables: number) {
  const seats: { table_number: number; seat_number: number }[] = [];
  for (let table = 1; table <= activeTables; table++) {
    for (let seat = 1; seat <= 10; seat++) {
      seats.push({ table_number: table, seat_number: seat });
    }
  }
  return seats;
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [rows, setRows] = useState<SeatRow[]>([]);
  const [settings, setSettings] = useState<TournamentSettings>({
    id: 1,
    active_tables: 6,
    player_limit: 60
  });

  const [draftTables, setDraftTables] = useState(6);
  const [draftPlayers, setDraftPlayers] = useState(60);
  const [playerName, setPlayerName] = useState("");
  const [message, setMessage] = useState("Настройте турнир и выдавайте места игрокам");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    loadAll();

    const channel = supabase
      .channel("pride-seating-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "seats" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_settings" }, loadAll)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function signIn() {
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setRows([]);
  }

  async function loadAll() {
    const [seatsRes, settingsRes] = await Promise.all([
      supabase
        .from("seats")
        .select("*")
        .order("table_number")
        .order("seat_number"),
      supabase
        .from("tournament_settings")
        .select("*")
        .eq("id", 1)
        .single()
    ]);

    if (seatsRes.error) setError(seatsRes.error.message);
    if (settingsRes.error) setError(settingsRes.error.message);

    if (seatsRes.data) setRows(seatsRes.data as SeatRow[]);
    if (settingsRes.data) {
      const next = settingsRes.data as TournamentSettings;
      setSettings(next);
      setDraftTables(next.active_tables);
      setDraftPlayers(next.player_limit);
    }
  }

  const freeSeats = useMemo(() => {
    const used = new Set(rows.map((row) => `${row.table_number}-${row.seat_number}`));

    return buildSeats(settings.active_tables).filter(
      (seat) => !used.has(`${seat.table_number}-${seat.seat_number}`)
    );
  }, [rows, settings.active_tables]);

  async function saveSettings() {
    setError("");
    setNotice("");

    const maximum = draftTables * 10;

    if (draftTables < 1 || draftTables > 6) {
      setError("Количество активных столов должно быть от 1 до 6");
      return;
    }

    if (draftPlayers < 1 || draftPlayers > maximum) {
      setError(`При ${draftTables} столах можно указать от 1 до ${maximum} игроков`);
      return;
    }

    if (rows.some((row) => row.table_number > draftTables)) {
      setError("На отключаемых столах уже есть игроки. Сначала удалите их или сбросьте турнир");
      return;
    }

    if (rows.length > draftPlayers) {
      setError("Лимит игроков меньше уже выданного количества мест");
      return;
    }

    const { error } = await supabase
      .from("tournament_settings")
      .update({
        active_tables: draftTables,
        player_limit: draftPlayers,
        updated_at: new Date().toISOString()
      })
      .eq("id", 1);

    if (error) {
      setError(error.message);
      return;
    }

    setNotice("Настройки сохранены");
    await loadAll();
  }

  async function assignSeat() {
    setError("");
    setNotice("");

    const name = playerName.trim();

    if (!name) {
      setError("Введите имя игрока");
      return;
    }

    if (rows.length >= settings.player_limit) {
      setError(`Лимит ${settings.player_limit} игроков уже достигнут`);
      return;
    }

    if (freeSeats.length === 0) {
      setError("На активных столах больше нет свободных мест");
      return;
    }

    const chosen = randomItem(freeSeats);

    const { data, error } = await supabase
      .from("seats")
      .insert({
        player_name: name,
        table_number: chosen.table_number,
        seat_number: chosen.seat_number
      })
      .select()
      .single();

    if (error) {
      setError(error.message);
      await loadAll();
      return;
    }

    setPlayerName("");
    setMessage(`${name}\nСтол ${data.table_number} · Место ${data.seat_number}`);
    await loadAll();
  }

  async function removeSeat(id: string) {
    if (!confirm("Удалить игрока и освободить место?")) return;

    const { error } = await supabase.from("seats").delete().eq("id", id);
    if (error) setError(error.message);

    await loadAll();
  }

  async function resetTournament() {
    if (!confirm("Сбросить всю рассадку турнира?")) return;

    const { error } = await supabase
      .from("seats")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Турнир сброшен");
    await loadAll();
  }

  function copyTelegram() {
    if (!rows.length) {
      alert("Пока нет рассадки");
      return;
    }

    const sorted = [...rows].sort(
      (a, b) => a.table_number - b.table_number || a.seat_number - b.seat_number
    );

    let text =
      `🦁 PRIDE | Рассадка\n` +
      `Активных столов: ${settings.active_tables}\n` +
      `Игроков: ${rows.length}/${settings.player_limit}\n\n`;

    for (let table = 1; table <= settings.active_tables; table++) {
      text += `Стол ${table}\n`;

      sorted
        .filter((row) => row.table_number === table)
        .forEach((row) => {
          text += `Место ${row.seat_number} — ${row.player_name}\n`;
        });

      text += "\n";
    }

    navigator.clipboard.writeText(text).then(() => alert("Список скопирован"));
  }

  if (authLoading) {
    return <div className="wrap"><div className="card login">Загрузка...</div></div>;
  }

  if (!user) {
    return (
      <div className="wrap">
        <div className="hero">
          <h1>PRIDE POKER CLUB</h1>
          <div className="sub">Вход администратора</div>
        </div>

        <div className="card login">
          <label>Email</label>
          <input value={email} onChange={(event) => setEmail(event.target.value)} />

          <label>Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && signIn()}
          />

          <button className="btn primary" onClick={signIn}>Войти</button>
          {error && <div className="result err">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="hero">
        <h1>PRIDE POKER CLUB</h1>
        <div className="sub">Рандомайзер рассадки с активными столами</div>
      </div>

      <div className="topbar">
        <button className="smallbtn" onClick={signOut}>Выйти</button>
      </div>

      <div className="grid">
        <div className="card">
          <h2 style={{ marginTop: 0, color: "var(--gold2)" }}>Настройки турнира</h2>

          <div className="settingsGrid">
            <div>
              <label>Активных столов</label>
              <select
                value={draftTables}
                onChange={(event) => {
                  const tables = Number(event.target.value);
                  setDraftTables(tables);
                  if (draftPlayers > tables * 10) {
                    setDraftPlayers(tables * 10);
                  }
                }}
              >
                {[1, 2, 3, 4, 5, 6].map((number) => (
                  <option key={number} value={number}>{number}</option>
                ))}
              </select>
            </div>

            <div>
              <label>Количество игроков</label>
              <input
                type="number"
                min={1}
                max={draftTables * 10}
                value={draftPlayers}
                onChange={(event) => setDraftPlayers(Number(event.target.value))}
              />
            </div>
          </div>

          <button className="btn secondary" onClick={saveSettings}>
            Сохранить настройки
          </button>

          <label>Имя игрока</label>
          <input
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && assignSeat()}
            placeholder="Например: Rivarez"
          />

          <button className="btn primary" onClick={assignSeat}>🎲 Выдать место</button>
          <button className="btn secondary" onClick={copyTelegram}>Скопировать для Telegram</button>
          <button className="btn danger" onClick={resetTournament}>Сбросить турнир</button>

          <div className="result">
            {message.includes("\n") ? (
              <>
                <div className="player">{message.split("\n")[0]}</div>
                <div className="big">{message.split("\n")[1]}</div>
                <div className="meta">Место закреплено и повторно не выпадет</div>
              </>
            ) : (
              <div className="meta">{message}</div>
            )}

            {error && <div className="err" style={{ marginTop: 10 }}>{error}</div>}
            {notice && <div className="ok" style={{ marginTop: 10 }}>{notice}</div>}
          </div>

          <div className="stats">
            <div className="stat"><b>{rows.length}</b>Выдано</div>
            <div className="stat"><b>{settings.player_limit - rows.length}</b>Осталось</div>
            <div className="stat"><b>{settings.active_tables}</b>Столов</div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0, color: "var(--gold2)" }}>
            Рассадка: {rows.length}/{settings.player_limit}
          </h2>

          <div className="tables">
            {Array.from({ length: settings.active_tables }, (_, index) => index + 1).map((table) => (
              <div className="table" key={table}>
                <h3>Стол {table}</h3>

                {Array.from({ length: 10 }, (_, index) => index + 1).map((seat) => {
                  const found = rows.find(
                    (row) => row.table_number === table && row.seat_number === seat
                  );

                  return (
                    <div className={`seat ${found ? "occupied" : "empty"}`} key={seat}>
                      <span>Место {seat}</span>
                      <span>{found ? found.player_name : "свободно"}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="list">
            {!rows.length && <div className="meta">Пока нет выданных мест</div>}

            {rows.map((row) => (
              <div className="row" key={row.id}>
                <div>{row.player_name}</div>
                <div>Стол {row.table_number}</div>
                <div>Место {row.seat_number}</div>
                <button className="x" onClick={() => removeSeat(row.id)}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
