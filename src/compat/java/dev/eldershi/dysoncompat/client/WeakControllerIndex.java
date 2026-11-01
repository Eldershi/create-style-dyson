package dev.eldershi.dysoncompat.client;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.WeakHashMap;
import java.util.function.Predicate;

/** An event-fed weak index, containing only controllers explicitly registered. */
final class WeakControllerIndex<T> {
    private final Map<T, Boolean> entries = new WeakHashMap<>();

    synchronized boolean add(T controller) { return entries.put(controller, Boolean.TRUE) == null; }
    synchronized boolean remove(T controller) { return entries.remove(controller) != null; }
    synchronized int size() { return entries.size(); }

    synchronized List<T> retain(Predicate<T> belongs) {
        List<T> result = new ArrayList<>();
        var iterator = entries.keySet().iterator();
        while (iterator.hasNext()) {
            T controller = iterator.next();
            if (!belongs.test(controller)) iterator.remove();
            else result.add(controller);
        }
        return result;
    }
}
