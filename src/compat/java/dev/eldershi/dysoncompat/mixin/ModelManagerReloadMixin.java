package dev.eldershi.dysoncompat.mixin;

import dev.eldershi.dysoncompat.client.ApprovedVisuals;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import net.minecraft.client.resources.model.ModelManager;
import net.minecraft.server.packs.resources.PreparableReloadListener.PreparationBarrier;
import net.minecraft.server.packs.resources.ResourceManager;
import net.minecraft.util.profiling.ProfilerFiller;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(value = ModelManager.class, remap = false)
public abstract class ModelManagerReloadMixin {
    @Inject(method = "m_5540_(Lnet/minecraft/server/packs/resources/PreparableReloadListener$PreparationBarrier;Lnet/minecraft/server/packs/resources/ResourceManager;Lnet/minecraft/util/profiling/ProfilerFiller;Lnet/minecraft/util/profiling/ProfilerFiller;Ljava/util/concurrent/Executor;Ljava/util/concurrent/Executor;)Ljava/util/concurrent/CompletableFuture;", at = @At("HEAD"), remap = false)
    private void createStyleDyson$prepareObjResources(PreparationBarrier barrier, ResourceManager resources,
            ProfilerFiller preparationProfiler, ProfilerFiller reloadProfiler, Executor preparationExecutor,
            Executor reloadExecutor, CallbackInfoReturnable<CompletableFuture<Void>> result) {
        ApprovedVisuals.onModelPreparation(resources);
    }
}
