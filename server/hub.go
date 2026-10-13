package main

import (
	"sync"
)

// Hub fans out live events to everyone watching a survey (the leader's dashboard).
type Hub struct {
	mu   sync.Mutex
	subs map[string]map[chan []byte]struct{}
}

func newHub() *Hub { return &Hub{subs: map[string]map[chan []byte]struct{}{}} }

func (h *Hub) subscribe(surveyID string) chan []byte {
	ch := make(chan []byte, 32)
	h.mu.Lock()
	if h.subs[surveyID] == nil {
		h.subs[surveyID] = map[chan []byte]struct{}{}
	}
	h.subs[surveyID][ch] = struct{}{}
	h.mu.Unlock()
	return ch
}

func (h *Hub) unsubscribe(surveyID string, ch chan []byte) {
	h.mu.Lock()
	delete(h.subs[surveyID], ch)
	h.mu.Unlock()
}

func (h *Hub) publish(surveyID string, msg []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.subs[surveyID] {
		select {
		case ch <- msg:
		default: // slow reader: drop; the dashboard re-fetches the list on reconnect
		}
	}
}
